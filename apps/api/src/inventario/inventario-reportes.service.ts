import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EstadoEquipo,
  Prisma,
  Role,
  TipoMovimiento,
  TipoRecurso,
} from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import {
  esFechaValida,
  finDiaRd,
  inicioDiaRd,
  partesRd,
  sumarDias,
} from '../common/rd-time';
import { PrismaService } from '../prisma/prisma.service';
import {
  ReporteExistenciasQueryDto,
  ReporteMovimientosQueryDto,
} from './dto/inventario.dto';
import {
  DIAS_ALERTA_VENCIMIENTO,
  ESTADO_EQUIPO_LABELS,
  estadoLote,
  hoyRd,
  ymd,
} from './inventario-rules';
import { RECURSO_INCLUDE, recursoPublico } from './recursos.service';

const r2 = (n: number) => Math.round(n * 100) / 100;
const TIPOS = Object.values(TipoMovimiento);
const ESTADOS_EQUIPO = Object.values(EstadoEquipo);
const DIA_MS = 86_400_000;

export const TIPO_MOV_LABELS: Record<TipoMovimiento, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  AJUSTE: 'Ajuste',
  ASIGNACION: 'Asignación',
  DEVOLUCION: 'Devolución',
};

const CATEGORIA_LABELS: Record<string, string> = {
  MATERIAL_MEDICO: 'Material médico',
  MEDICAMENTO: 'Medicamento',
  REACTIVO: 'Reactivo',
  EQUIPO_MEDICO: 'Equipo médico',
  OTRO: 'Otro',
};

/** Rango de días (AAAA-MM-DD) entre dos fechas, incluidas. */
function dias(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let f = desde, i = 0; f <= hasta && i < 370; f = sumarDias(f, 1), i++) {
    out.push(f);
  }
  return out;
}

@Injectable()
export class InventarioReportesService {
  constructor(private readonly prisma: PrismaService) {}

  private centro(actor: AuthUser, pedido?: string): string | null {
    return actor.role === Role.CENTRO_MEDICO ? actor.id : (pedido ?? null);
  }

  /** Existencias: stock y valor por recurso, alertas y equipos por estado. */
  async existencias(actor: AuthUser, query: ReporteExistenciasQueryDto) {
    const centroId = this.centro(actor, query.centroId);
    const hoy = hoyRd();
    const recursos = await this.prisma.recurso.findMany({
      where: { ...(centroId ? { centroId } : {}), activo: true },
      include: RECURSO_INCLUDE,
      orderBy: [{ tipo: 'desc' }, { nombre: 'asc' }],
    });
    const pub = recursos.map((r) => recursoPublico(r, hoy));
    const insumos = pub.filter((r) => r.tipo === TipoRecurso.INSUMO);
    const equipos = pub.filter((r) => r.tipo === TipoRecurso.EQUIPO);

    const lotesAlerta = (estado: 'PROXIMO_A_VENCER' | 'VENCIDO') =>
      recursos.flatMap((r) =>
        r.lotes
          .filter(
            (l) =>
              l.cantidadDisponible > 0 &&
              estadoLote(l.fechaVencimiento, hoy) === estado,
          )
          .map((l) => ({
            recursoId: r.id,
            codigo: r.codigo,
            nombre: r.nombre,
            centro: r.centro.fullName,
            numeroLote: l.numeroLote,
            fechaVencimiento: ymd(l.fechaVencimiento),
            dias: Math.round(
              (Date.parse(`${ymd(l.fechaVencimiento)}T00:00:00Z`) -
                Date.parse(`${hoy}T00:00:00Z`)) /
                DIA_MS,
            ),
            cantidad: l.cantidadDisponible,
            valor: r2(l.cantidadDisponible * Number(r.costoUnitario)),
          }))
          .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento)),
      );
    const proximos = lotesAlerta('PROXIMO_A_VENCER');
    const vencidos = lotesAlerta('VENCIDO');
    const bajoStock = insumos.filter((r) => r.alertas.bajoStock);

    const porCategoria = new Map<
      string,
      { categoria: string; recursos: number; valor: number }
    >();
    for (const r of pub) {
      const c = porCategoria.get(r.categoria) ?? {
        categoria: CATEGORIA_LABELS[r.categoria],
        recursos: 0,
        valor: 0,
      };
      c.recursos++;
      c.valor = r2(c.valor + r.valor);
      porCategoria.set(r.categoria, c);
    }
    const equiposPorEstado = Object.fromEntries(
      ESTADOS_EQUIPO.map((e) => [e, 0]),
    ) as Record<EstadoEquipo, number>;
    // Los equipos dados de baja están inactivos: se cuentan aparte
    const bajas = await this.prisma.recurso.count({
      where: {
        ...(centroId ? { centroId } : {}),
        tipo: TipoRecurso.EQUIPO,
        estadoEquipo: EstadoEquipo.BAJA,
      },
    });
    for (const e of equipos) equiposPorEstado[e.estadoEquipo ?? 'DISPONIBLE']++;
    equiposPorEstado.BAJA = bajas;

    const valorInsumos = r2(insumos.reduce((s, r) => s + r.valor, 0));
    const valorEquipos = r2(equipos.reduce((s, r) => s + r.valor, 0));
    return {
      filtros: { centroId },
      generadoEn: new Date().toISOString(),
      diasAlertaVencimiento: DIAS_ALERTA_VENCIMIENTO,
      totales: {
        recursos: pub.length,
        insumos: insumos.length,
        equipos: equipos.length,
        unidades: insumos.reduce((s, r) => s + (r.stockActual ?? 0), 0),
        valorInsumos,
        valorEquipos,
        valorTotal: r2(valorInsumos + valorEquipos),
        bajoStock: bajoStock.length,
        proximoAVencer: proximos.length,
        unidadesProximasAVencer: proximos.reduce((s, l) => s + l.cantidad, 0),
        vencido: vencidos.length,
        unidadesVencidas: vencidos.reduce((s, l) => s + l.cantidad, 0),
        valorVencido: r2(vencidos.reduce((s, l) => s + l.valor, 0)),
      },
      equiposPorEstado,
      porCategoria: [...porCategoria.values()].sort(
        (a, b) => b.valor - a.valor,
      ),
      recursos: pub.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        tipo: r.tipo,
        categoria: r.categoria,
        unidad: r.unidad,
        centro: r.centro.fullName,
        stockActual: r.stockActual,
        disponible: r.disponible,
        stockMinimo: r.stockMinimo,
        unidadesVencidas: r.unidadesVencidas,
        costoUnitario: r.costoUnitario,
        valor: r.valor,
        estadoEquipo: r.estadoEquipo,
        medicoAsignado: r.medicoAsignado?.nombre ?? null,
        alertas: r.alertas,
      })),
      bajoStock: bajoStock.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        centro: r.centro.fullName,
        disponible: r.disponible,
        stockMinimo: r.stockMinimo,
        unidad: r.unidad,
      })),
      proximosAVencer: proximos,
      vencidos,
    };
  }

  /** Movimientos de un período: por tipo, por recurso, por día y consumo por cita. */
  async movimientos(actor: AuthUser, query: ReporteMovimientosQueryDto) {
    for (const f of [query.desde, query.hasta]) {
      if (f && !esFechaValida(f))
        throw new BadRequestException('La fecha no es válida.');
    }
    const hoy = hoyRd();
    const desde = query.desde ?? sumarDias(hoy, -20);
    const hasta = query.hasta ?? hoy;
    if (desde > hasta) {
      throw new BadRequestException(
        'La fecha "desde" no puede ser posterior a "hasta".',
      );
    }
    const centroId = this.centro(actor, query.centroId);
    const where: Prisma.MovimientoWhereInput = {
      createdAt: { gte: inicioDiaRd(desde), lte: finDiaRd(hasta) },
      ...(centroId ? { centroId } : {}),
    };
    const movs = await this.prisma.movimiento.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { codigo: 'asc' }],
      include: {
        recurso: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            unidad: true,
            tipo: true,
          },
        },
        usuario: { select: { fullName: true } },
        medico: { select: { nombre: true } },
        lote: { select: { numeroLote: true } },
        cita: {
          select: {
            id: true,
            codigo: true,
            fechaHora: true,
            paciente: { select: { fullName: true } },
            medico: { select: { nombre: true } },
          },
        },
      },
    });

    // Los movimientos de equipos (asignar, devolver, cambiar estado) no mueven valor
    const valorDe = (m: (typeof movs)[number]) =>
      m.recurso.tipo === TipoRecurso.EQUIPO
        ? 0
        : r2(m.cantidad * Number(m.costoUnitario ?? 0));
    const aumento = (m: (typeof movs)[number]) =>
      m.tipo === TipoMovimiento.ENTRADA ||
      (m.tipo === TipoMovimiento.AJUSTE &&
        m.stockNuevo !== null &&
        m.stockAnterior !== null &&
        m.stockNuevo > m.stockAnterior);

    const porTipo = Object.fromEntries(
      TIPOS.map((t) => [t, { movimientos: 0, unidades: 0, valor: 0 }]),
    ) as Record<
      TipoMovimiento,
      { movimientos: number; unidades: number; valor: number }
    >;
    const porRecurso = new Map<
      string,
      {
        recursoId: string;
        codigo: string;
        nombre: string;
        unidad: string;
        entradas: number;
        salidas: number;
        ajustesMas: number;
        ajustesMenos: number;
        asignaciones: number;
        devoluciones: number;
        valorEntradas: number;
        valorSalidas: number;
      }
    >();
    const porDia = new Map(
      dias(desde, hasta).map((f) => [
        f,
        { fecha: f, entradas: 0, salidas: 0, ajustes: 0, equipos: 0 },
      ]),
    );
    const consumo = new Map<
      string,
      {
        citaId: string;
        codigo: string;
        fechaHora: Date;
        paciente: string;
        medico: string;
        items: {
          recurso: string;
          cantidad: number;
          unidad: string;
          valor: number;
        }[];
        total: number;
      }
    >();

    for (const m of movs) {
      const v = valorDe(m);
      const t = porTipo[m.tipo];
      t.movimientos++;
      t.unidades += m.cantidad;
      t.valor = r2(t.valor + v);

      let pr = porRecurso.get(m.recursoId);
      if (!pr) {
        pr = {
          recursoId: m.recursoId,
          codigo: m.recurso.codigo,
          nombre: m.recurso.nombre,
          unidad: m.recurso.unidad,
          entradas: 0,
          salidas: 0,
          ajustesMas: 0,
          ajustesMenos: 0,
          asignaciones: 0,
          devoluciones: 0,
          valorEntradas: 0,
          valorSalidas: 0,
        };
        porRecurso.set(m.recursoId, pr);
      }
      if (m.tipo === TipoMovimiento.ENTRADA) {
        pr.entradas += m.cantidad;
        pr.valorEntradas = r2(pr.valorEntradas + v);
      } else if (m.tipo === TipoMovimiento.SALIDA) {
        pr.salidas += m.cantidad;
        pr.valorSalidas = r2(pr.valorSalidas + v);
      } else if (m.tipo === TipoMovimiento.AJUSTE && m.stockNuevo !== null) {
        if (aumento(m)) pr.ajustesMas += m.cantidad;
        else pr.ajustesMenos += m.cantidad;
      } else if (m.tipo === TipoMovimiento.ASIGNACION) pr.asignaciones++;
      else if (m.tipo === TipoMovimiento.DEVOLUCION) pr.devoluciones++;

      const d = porDia.get(partesRd(m.createdAt).fecha);
      if (d) {
        if (m.tipo === TipoMovimiento.ENTRADA) d.entradas += m.cantidad;
        else if (m.tipo === TipoMovimiento.SALIDA) d.salidas += m.cantidad;
        else if (m.tipo === TipoMovimiento.AJUSTE && m.stockNuevo !== null)
          d.ajustes += m.cantidad;
        else d.equipos++;
      }

      if (m.tipo === TipoMovimiento.SALIDA && m.cita) {
        let c = consumo.get(m.cita.id);
        if (!c) {
          c = {
            citaId: m.cita.id,
            codigo: m.cita.codigo,
            fechaHora: m.cita.fechaHora,
            paciente: m.cita.paciente.fullName,
            medico: m.cita.medico.nombre,
            items: [],
            total: 0,
          };
          consumo.set(m.cita.id, c);
        }
        const item = c.items.find((i) => i.recurso === m.recurso.nombre);
        if (item) {
          item.cantidad += m.cantidad;
          item.valor = r2(item.valor + v);
        } else {
          c.items.push({
            recurso: m.recurso.nombre,
            cantidad: m.cantidad,
            unidad: m.recurso.unidad,
            valor: v,
          });
        }
        c.total = r2(c.total + v);
      }
    }

    return {
      filtros: { desde, hasta, centroId },
      generadoEn: new Date().toISOString(),
      totales: {
        movimientos: movs.length,
        unidadesEntrada: porTipo.ENTRADA.unidades,
        unidadesSalida: porTipo.SALIDA.unidades,
        valorEntradas: porTipo.ENTRADA.valor,
        valorSalidas: porTipo.SALIDA.valor,
        citasConConsumo: consumo.size,
        valorConsumoCitas: r2(
          [...consumo.values()].reduce((s, c) => s + c.total, 0),
        ),
      },
      porTipo,
      porRecurso: [...porRecurso.values()].sort(
        (a, b) =>
          b.entradas + b.salidas - (a.entradas + a.salidas) ||
          a.nombre.localeCompare(b.nombre),
      ),
      porDia: [...porDia.values()],
      consumoPorCita: [...consumo.values()].sort(
        (a, b) => b.fechaHora.getTime() - a.fechaHora.getTime(),
      ),
      detalle: movs.map((m) => ({
        codigo: m.codigo,
        fecha: m.createdAt,
        tipo: m.tipo,
        recurso: `${m.recurso.codigo} ${m.recurso.nombre}`,
        cantidad: m.cantidad,
        unidad: m.recurso.unidad,
        stockAnterior: m.stockAnterior,
        stockNuevo: m.stockNuevo,
        estado: m.estadoEquipoNuevo
          ? `${ESTADO_EQUIPO_LABELS[m.estadoEquipoAnterior ?? 'DISPONIBLE']} → ${ESTADO_EQUIPO_LABELS[m.estadoEquipoNuevo]}`
          : '',
        lote: m.lote?.numeroLote ?? '',
        medico: m.medico?.nombre ?? '',
        cita: m.cita?.codigo ?? '',
        usuario: m.usuario.fullName,
        motivo: m.motivo,
        valor: valorDe(m),
      })),
    };
  }

  // ─── CSV ───────────────────────────────────────────────────────────

  existenciasCsv(
    r: Awaited<ReturnType<InventarioReportesService['existencias']>>,
  ) {
    const t = r.totales;
    return toCsv([
      ['Reporte de existencias - MediCita RD'],
      ['Generado', r.generadoEn],
      [],
      ['Resumen'],
      ['Recursos activos', t.recursos],
      ['Insumos', t.insumos],
      ['Equipos', t.equipos],
      ['Valor total del inventario (DOP)', t.valorTotal.toFixed(2)],
      ['Valor en insumos (DOP)', t.valorInsumos.toFixed(2)],
      ['Valor en equipos (DOP)', t.valorEquipos.toFixed(2)],
      ['Bajo stock (insumos)', t.bajoStock],
      [
        `Próximo a vencer (lotes, ${r.diasAlertaVencimiento} días)`,
        t.proximoAVencer,
      ],
      ['Vencido (lotes)', t.vencido],
      ['Unidades vencidas', t.unidadesVencidas],
      ...ESTADOS_EQUIPO.map((e) => [
        `Equipos: ${ESTADO_EQUIPO_LABELS[e]}`,
        r.equiposPorEstado[e],
      ]),
      [],
      ['Existencias'],
      [
        'Código',
        'Recurso',
        'Tipo',
        'Categoría',
        'Centro',
        'Stock',
        'Disponible',
        'Mínimo',
        'Vencidas',
        'Unidad',
        'Estado del equipo',
        'Asignado a',
        'Costo unitario (DOP)',
        'Valor (DOP)',
        'Alertas',
      ],
      ...r.recursos.map((x) => [
        x.codigo,
        x.nombre,
        x.tipo,
        CATEGORIA_LABELS[x.categoria],
        x.centro,
        x.stockActual ?? '',
        x.tipo === TipoRecurso.INSUMO ? x.disponible : '',
        x.stockMinimo ?? '',
        x.unidadesVencidas || '',
        x.unidad,
        x.estadoEquipo ? ESTADO_EQUIPO_LABELS[x.estadoEquipo] : '',
        x.medicoAsignado ?? '',
        x.costoUnitario.toFixed(2),
        x.valor.toFixed(2),
        [
          x.alertas.bajoStock ? 'Bajo stock' : '',
          x.alertas.proximoAVencer ? 'Próximo a vencer' : '',
          x.alertas.vencido ? 'Vencido' : '',
        ]
          .filter(Boolean)
          .join(' / '),
      ]),
      [],
      ['Lotes próximos a vencer'],
      ['Código', 'Recurso', 'Lote', 'Vence', 'Días', 'Cantidad', 'Valor (DOP)'],
      ...r.proximosAVencer.map((l) => [
        l.codigo,
        l.nombre,
        l.numeroLote,
        l.fechaVencimiento,
        l.dias,
        l.cantidad,
        l.valor.toFixed(2),
      ]),
      [],
      ['Lotes vencidos'],
      [
        'Código',
        'Recurso',
        'Lote',
        'Venció',
        'Días',
        'Cantidad',
        'Valor (DOP)',
      ],
      ...r.vencidos.map((l) => [
        l.codigo,
        l.nombre,
        l.numeroLote,
        l.fechaVencimiento,
        l.dias,
        l.cantidad,
        l.valor.toFixed(2),
      ]),
    ]);
  }

  movimientosCsv(
    r: Awaited<ReturnType<InventarioReportesService['movimientos']>>,
  ) {
    const t = r.totales;
    return toCsv([
      ['Reporte de movimientos de inventario - MediCita RD'],
      ['Desde', r.filtros.desde],
      ['Hasta', r.filtros.hasta],
      ['Generado', r.generadoEn],
      [],
      ['Resumen'],
      ['Movimientos', t.movimientos],
      ['Unidades que entraron', t.unidadesEntrada],
      ['Unidades que salieron', t.unidadesSalida],
      ['Valor de las entradas (DOP)', t.valorEntradas.toFixed(2)],
      ['Valor de las salidas (DOP)', t.valorSalidas.toFixed(2)],
      ['Citas con consumo', t.citasConConsumo],
      ['Valor consumido en citas (DOP)', t.valorConsumoCitas.toFixed(2)],
      [],
      ['Por tipo'],
      ['Tipo', 'Movimientos', 'Unidades', 'Valor (DOP)'],
      ...TIPOS.map((x) => [
        TIPO_MOV_LABELS[x],
        r.porTipo[x].movimientos,
        r.porTipo[x].unidades,
        r.porTipo[x].valor.toFixed(2),
      ]),
      [],
      ['Por recurso'],
      [
        'Código',
        'Recurso',
        'Entradas',
        'Salidas',
        'Ajustes +',
        'Ajustes -',
        'Asignaciones',
        'Devoluciones',
        'Valor entradas (DOP)',
        'Valor salidas (DOP)',
      ],
      ...r.porRecurso.map((x) => [
        x.codigo,
        x.nombre,
        x.entradas,
        x.salidas,
        x.ajustesMas,
        x.ajustesMenos,
        x.asignaciones,
        x.devoluciones,
        x.valorEntradas.toFixed(2),
        x.valorSalidas.toFixed(2),
      ]),
      [],
      ['Por día'],
      [
        'Fecha',
        'Unidades entrada',
        'Unidades salida',
        'Unidades ajuste',
        'Movimientos de equipos',
      ],
      ...r.porDia.map((d) => [
        d.fecha,
        d.entradas,
        d.salidas,
        d.ajustes,
        d.equipos,
      ]),
      [],
      ['Consumo por cita'],
      ['Cita', 'Fecha (RD)', 'Paciente', 'Médico', 'Insumos', 'Total (DOP)'],
      ...r.consumoPorCita.map((c) => [
        c.codigo,
        partesRd(c.fechaHora).fecha,
        c.paciente,
        c.medico,
        c.items.map((i) => `${i.cantidad} ${i.unidad} ${i.recurso}`).join('; '),
        c.total.toFixed(2),
      ]),
      [],
      ['Detalle'],
      [
        'Código',
        'Fecha (RD)',
        'Tipo',
        'Recurso',
        'Cantidad',
        'Unidad',
        'Stock antes',
        'Stock después',
        'Estado del equipo',
        'Lote',
        'Médico',
        'Cita',
        'Usuario',
        'Motivo',
        'Valor (DOP)',
      ],
      ...r.detalle.map((m) => {
        const p = partesRd(m.fecha);
        const hora = `${String(Math.floor(p.minutos / 60)).padStart(2, '0')}:${String(p.minutos % 60).padStart(2, '0')}`;
        return [
          m.codigo,
          `${p.fecha} ${hora}`,
          TIPO_MOV_LABELS[m.tipo],
          m.recurso,
          m.cantidad,
          m.unidad,
          m.stockAnterior ?? '',
          m.stockNuevo ?? '',
          m.estado,
          m.lote,
          m.medico,
          m.cita,
          m.usuario,
          m.motivo,
          m.valor.toFixed(2),
        ];
      }),
    ]);
  }
}

function toCsv(filas: (string | number)[][]): string {
  return '\uFEFF' + filas.map((f) => f.map(csvCelda).join(',')).join('\r\n');
}

function csvCelda(valor: string | number): string {
  const s = String(valor);
  // Comillas si hace falta y neutraliza fórmulas al abrir en Excel
  const seguro = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}
