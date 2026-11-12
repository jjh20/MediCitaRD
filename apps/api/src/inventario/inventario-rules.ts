/**
 * Reglas de negocio del inventario (L1–L10) como funciones puras.
 * Lanzan excepciones HTTP con mensajes en español; los servicios las usan
 * dentro de la transacción (con la fila del recurso bloqueada) y las pruebas
 * unitarias las cubren una por una.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EstadoCita, EstadoEquipo, TipoRecurso } from '@prisma/client';
import { partesRd, sumarDias } from '../common/rd-time';
import { ESTADO_LABELS } from '../citas/cita-rules';

export const DIAS_ALERTA_VENCIMIENTO = 30;

export const ESTADO_EQUIPO_LABELS: Record<EstadoEquipo, string> = {
  DISPONIBLE: 'Disponible',
  ASIGNADO: 'Asignado',
  MANTENIMIENTO: 'En mantenimiento',
  BAJA: 'De baja',
};

export interface RecursoRegla {
  codigo: string;
  nombre: string;
  tipo: TipoRecurso;
  activo: boolean;
  requiereVencimiento: boolean;
  stockActual: number | null;
  stockMinimo: number | null;
  estadoEquipo: EstadoEquipo | null;
}

export interface LoteRegla {
  id: string;
  numeroLote: string;
  fechaVencimiento: Date;
  cantidadDisponible: number;
  createdAt?: Date;
}

export type EstadoLote = 'VIGENTE' | 'PROXIMO_A_VENCER' | 'VENCIDO';

/** Fecha de hoy (AAAA-MM-DD) en hora de RD. */
export const hoyRd = (ahora = new Date()) => partesRd(ahora).fecha;

/** AAAA-MM-DD de una fecha de calendario guardada como @db.Date (medianoche UTC). */
export const ymd = (fecha: Date) => fecha.toISOString().slice(0, 10);

/** L1: cantidades enteras mayores que 0. */
export function validarCantidad(cantidad: number): void {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new BadRequestException(
      'La cantidad debe ser un número entero mayor que 0.',
    );
  }
}

/** L6: un recurso inactivo o dado de baja no admite movimientos. */
export function validarOperable(r: RecursoRegla): void {
  if (!r.activo || r.estadoEquipo === EstadoEquipo.BAJA) {
    throw new ConflictException(
      `${r.nombre} (${r.codigo}) está ${r.estadoEquipo === EstadoEquipo.BAJA ? 'dado de baja' : 'inactivo'} y no admite movimientos.`,
    );
  }
}

/** Entradas, salidas y ajustes de stock solo para insumos. */
export function validarEsInsumo(r: RecursoRegla, operacion: string): void {
  if (r.tipo !== TipoRecurso.INSUMO) {
    throw new BadRequestException(
      `${operacion} solo aplica a insumos. ${r.nombre} es un equipo: usa asignar, devolver o cambiar su estado.`,
    );
  }
}

/** L2: no se puede sacar más de lo disponible. */
export function validarStockSuficiente(
  disponible: number,
  cantidad: number,
): void {
  if (cantidad > disponible) {
    throw new ConflictException(
      `Stock insuficiente (disponible: ${disponible}).`,
    );
  }
}

/** L10 / L3: estado de un lote según su vencimiento (en hora de RD). */
export function estadoLote(fechaVencimiento: Date, hoy: string): EstadoLote {
  const f = ymd(fechaVencimiento);
  if (f < hoy) return 'VENCIDO';
  if (f <= sumarDias(hoy, DIAS_ALERTA_VENCIMIENTO)) return 'PROXIMO_A_VENCER';
  return 'VIGENTE';
}

/** Lotes utilizables: con existencias y sin vencer, en orden FEFO. */
export function lotesUtilizables<T extends LoteRegla>(
  lotes: T[],
  hoy: string,
): T[] {
  return lotes
    .filter(
      (l) =>
        l.cantidadDisponible > 0 &&
        estadoLote(l.fechaVencimiento, hoy) !== 'VENCIDO',
    )
    .sort(
      (a, b) =>
        a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime() ||
        (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
    );
}

/** Stock disponible para salidas: sin unidades vencidas (L3). */
export function stockDisponible(
  r: RecursoRegla,
  lotes: LoteRegla[],
  hoy: string,
): number {
  if (r.tipo !== TipoRecurso.INSUMO) return 0;
  if (!r.requiereVencimiento) return r.stockActual ?? 0;
  return lotesUtilizables(lotes, hoy).reduce(
    (s, l) => s + l.cantidadDisponible,
    0,
  );
}

/**
 * L3: FEFO (first expired, first out). Reparte la cantidad entre los lotes
 * no vencidos, empezando por el que vence antes. L2 si no alcanza.
 */
export function fefo<T extends LoteRegla>(
  lotes: T[],
  cantidad: number,
  hoy: string,
): { lote: T; cantidad: number }[] {
  const utilizables = lotesUtilizables(lotes, hoy);
  const disponible = utilizables.reduce((s, l) => s + l.cantidadDisponible, 0);
  validarStockSuficiente(disponible, cantidad);
  const reparto: { lote: T; cantidad: number }[] = [];
  let falta = cantidad;
  for (const lote of utilizables) {
    if (falta === 0) break;
    const toma = Math.min(falta, lote.cantidadDisponible);
    reparto.push({ lote, cantidad: toma });
    falta -= toma;
  }
  return reparto;
}

/** L3: la entrada de un insumo con vencimiento exige lote y fecha futura. */
export function validarLoteEntrada(
  r: RecursoRegla,
  numeroLote: string | undefined,
  fechaVencimiento: string | undefined,
  hoy: string,
): { numeroLote: string; fechaVencimiento: string } | null {
  if (!r.requiereVencimiento) return null;
  if (!numeroLote?.trim() || !fechaVencimiento) {
    throw new BadRequestException(
      `${r.nombre} requiere vencimiento: indica el número de lote y la fecha de vencimiento.`,
    );
  }
  if (fechaVencimiento <= hoy) {
    throw new BadRequestException(
      'La fecha de vencimiento debe ser futura: no se reciben lotes vencidos.',
    );
  }
  return { numeroLote: numeroLote.trim(), fechaVencimiento };
}

/** L4: asignar un equipo disponible a un médico activo del mismo centro. */
export function validarAsignacion(
  r: RecursoRegla & {
    centroId: string;
    medicoAsignado?: { nombre: string } | null;
  },
  medico: { nombre: string; centroId: string; activo: boolean },
  fechaDevolucion: Date,
  ahora: Date,
): void {
  if (r.tipo !== TipoRecurso.EQUIPO) {
    throw new BadRequestException(
      `Solo los equipos se asignan. ${r.nombre} es un insumo: registra una salida.`,
    );
  }
  if (r.estadoEquipo === EstadoEquipo.ASIGNADO) {
    throw new ConflictException(
      `${r.nombre} ya está asignado${r.medicoAsignado ? ` a ${r.medicoAsignado.nombre}` : ''}. Primero registra la devolución.`,
    );
  }
  if (r.estadoEquipo === EstadoEquipo.MANTENIMIENTO) {
    throw new ConflictException(
      `${r.nombre} está en mantenimiento y no se puede asignar.`,
    );
  }
  if (medico.centroId !== r.centroId) {
    throw new BadRequestException('El médico no pertenece a este centro.');
  }
  if (!medico.activo) {
    throw new BadRequestException(
      `${medico.nombre} está inactivo y no puede recibir equipos.`,
    );
  }
  if (fechaDevolucion.getTime() <= ahora.getTime()) {
    throw new BadRequestException(
      'La fecha de devolución prevista debe ser futura.',
    );
  }
}

/** L5: solo se devuelve un equipo asignado. */
export function validarDevolucion(r: RecursoRegla): void {
  if (r.tipo !== TipoRecurso.EQUIPO) {
    throw new BadRequestException('Solo los equipos se devuelven.');
  }
  if (r.estadoEquipo !== EstadoEquipo.ASIGNADO) {
    throw new ConflictException(
      `Solo se puede devolver un equipo asignado (estado actual: ${ESTADO_EQUIPO_LABELS[r.estadoEquipo ?? 'DISPONIBLE']}).`,
    );
  }
}

/** L7: el ajuste exige motivo y no puede dejar el stock negativo. */
export function validarAjuste(
  motivo: string | undefined,
  sentido: 'AUMENTO' | 'DISMINUCION',
  cantidad: number,
  disponible: number,
): string {
  const limpio = motivo?.trim();
  if (!limpio) {
    throw new BadRequestException('El ajuste exige un motivo.');
  }
  validarCantidad(cantidad);
  if (sentido === 'DISMINUCION' && cantidad > disponible) {
    throw new ConflictException(
      `El ajuste dejaría el stock negativo (disponible: ${disponible}).`,
    );
  }
  return limpio;
}

/** Cambios de estado del equipo por AJUSTE (mantenimiento ↔ disponible). */
export function validarCambioEstadoEquipo(
  r: RecursoRegla,
  nuevo: EstadoEquipo,
): void {
  const actual = r.estadoEquipo ?? EstadoEquipo.DISPONIBLE;
  const permitido =
    (actual === EstadoEquipo.DISPONIBLE &&
      nuevo === EstadoEquipo.MANTENIMIENTO) ||
    (actual === EstadoEquipo.MANTENIMIENTO &&
      nuevo === EstadoEquipo.DISPONIBLE);
  if (!permitido) {
    throw new ConflictException(
      `No se puede pasar ${r.nombre} de ${ESTADO_EQUIPO_LABELS[actual]} a ${ESTADO_EQUIPO_LABELS[nuevo]}.` +
        (actual === EstadoEquipo.ASIGNADO
          ? ' Primero registra la devolución.'
          : ''),
    );
  }
}

/** L8: el consumo se liga a una cita ATENDIDA (el centro se valida antes, con 403). */
export function validarCitaConsumo(cita: {
  codigo: string;
  estado: EstadoCita;
}): void {
  if (cita.estado !== EstadoCita.ATENDIDA) {
    throw new ConflictException(
      `Solo se registran insumos usados en una cita Atendida (${cita.codigo} está ${ESTADO_LABELS[cita.estado]}).`,
    );
  }
}

export interface Alertas {
  bajoStock: boolean;
  proximoAVencer: boolean;
  vencido: boolean;
}

/** L10: alertas de bajo stock y de vencimiento. */
export function alertas(
  r: RecursoRegla,
  lotes: LoteRegla[],
  hoy: string,
): Alertas {
  if (r.tipo !== TipoRecurso.INSUMO) {
    return { bajoStock: false, proximoAVencer: false, vencido: false };
  }
  const conStock = lotes.filter((l) => l.cantidadDisponible > 0);
  return {
    bajoStock:
      r.activo &&
      r.stockMinimo !== null &&
      stockDisponible(r, lotes, hoy) <= r.stockMinimo,
    proximoAVencer: conStock.some(
      (l) => estadoLote(l.fechaVencimiento, hoy) === 'PROXIMO_A_VENCER',
    ),
    vencido: conStock.some(
      (l) => estadoLote(l.fechaVencimiento, hoy) === 'VENCIDO',
    ),
  };
}
