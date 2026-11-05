/**
 * Reglas de negocio de las citas (R1–R9) como funciones puras.
 * Lanzan excepciones HTTP con mensajes en español; el servicio las usa
 * dentro de la transacción y las pruebas unitarias las cubren una por una.
 * R3/R4 (choques) y R10 (concurrencia) se validan contra la base en
 * CitasService, respaldadas por índices únicos parciales.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EstadoCita, Role } from '@prisma/client';
import {
  describirDias,
  formatoRd,
  horaAMinutos,
  minutosAHora,
  partesRd,
} from '../common/rd-time';

export const DIAS_MAX_ANTICIPACION = 90;
export const HORAS_MIN_CANCELACION_PACIENTE = 2;
const HORA_MS = 3_600_000;

export const ESTADOS_ACTIVOS: EstadoCita[] = [
  EstadoCita.PENDIENTE,
  EstadoCita.CONFIRMADA,
];
export const ESTADOS_CERRADOS: EstadoCita[] = [
  EstadoCita.ATENDIDA,
  EstadoCita.NO_ASISTIO,
  EstadoCita.CANCELADA,
];

export const ESTADO_LABELS: Record<EstadoCita, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  ATENDIDA: 'Atendida',
  NO_ASISTIO: 'No asistió',
  CANCELADA: 'Cancelada',
};

/** R6: transiciones de estado permitidas. */
export const TRANSICIONES: Record<EstadoCita, EstadoCita[]> = {
  PENDIENTE: [EstadoCita.CONFIRMADA, EstadoCita.CANCELADA],
  CONFIRMADA: [
    EstadoCita.ATENDIDA,
    EstadoCita.NO_ASISTIO,
    EstadoCita.CANCELADA,
  ],
  ATENDIDA: [],
  NO_ASISTIO: [],
  CANCELADA: [],
};

export const esCerrada = (estado: EstadoCita) =>
  ESTADOS_CERRADOS.includes(estado);

export interface HorarioMedico {
  nombre: string;
  diasSemana: number[];
  horaInicio: string;
  horaFin: string;
  duracionMin: number;
  activo: boolean;
}

/** R1: ni en el pasado ni con más de 90 días de anticipación. */
export function validarVentana(fechaHora: Date, ahora: Date): void {
  if (fechaHora.getTime() <= ahora.getTime()) {
    throw new BadRequestException(
      'No se puede agendar en una fecha u hora que ya pasó. Elige un horario futuro.',
    );
  }
  const limite = ahora.getTime() + DIAS_MAX_ANTICIPACION * 24 * HORA_MS;
  if (fechaHora.getTime() > limite) {
    throw new BadRequestException(
      `Solo se puede agendar con un máximo de ${DIAS_MAX_ANTICIPACION} días de anticipación.`,
    );
  }
}

/** R2: dentro del horario del médico y alineada a su duración. */
export function validarHorario(medico: HorarioMedico, fechaHora: Date): void {
  const { diaSemana, minutos } = partesRd(fechaHora);
  if (!medico.diasSemana.includes(diaSemana)) {
    throw new BadRequestException(
      `${medico.nombre} no atiende ese día. Atiende de ${describirDias(medico.diasSemana)}.`,
    );
  }
  const inicio = horaAMinutos(medico.horaInicio);
  const fin = horaAMinutos(medico.horaFin);
  if (minutos < inicio || minutos + medico.duracionMin > fin) {
    throw new BadRequestException(
      `La hora está fuera del horario de ${medico.nombre} (${medico.horaInicio} a ${medico.horaFin}).`,
    );
  }
  if (
    (minutos - inicio) % medico.duracionMin !== 0 ||
    fechaHora.getUTCSeconds() !== 0 ||
    fechaHora.getUTCMilliseconds() !== 0
  ) {
    throw new BadRequestException(
      `La hora debe coincidir con un turno de ${medico.duracionMin} minutos (por ejemplo ${medico.horaInicio} o ${minutosAHora(inicio + medico.duracionMin)}).`,
    );
  }
}

/** R5: no se agenda con un médico inactivo. */
export function validarMedicoActivo(medico: HorarioMedico): void {
  if (!medico.activo) {
    throw new BadRequestException(
      `${medico.nombre} no está disponible para nuevas citas.`,
    );
  }
}

/** R7: una cita cerrada no se puede modificar. */
export function validarModificable(codigo: string, estado: EstadoCita): void {
  if (esCerrada(estado)) {
    throw new ConflictException(
      `La cita ${codigo} ya está cerrada (${ESTADO_LABELS[estado]}) y no se puede modificar.`,
    );
  }
}

/** R6 + R7: valida el paso de un estado a otro. */
export function validarTransicion(
  codigo: string,
  actual: EstadoCita,
  nuevo: EstadoCita,
): void {
  validarModificable(codigo, actual);
  if (!TRANSICIONES[actual].includes(nuevo)) {
    throw new ConflictException(
      `No se puede pasar la cita ${codigo} de ${ESTADO_LABELS[actual]} a ${ESTADO_LABELS[nuevo]}.` +
        (actual === EstadoCita.PENDIENTE &&
        (nuevo === EstadoCita.ATENDIDA || nuevo === EstadoCita.NO_ASISTIO)
          ? ' Primero hay que confirmarla.'
          : ''),
    );
  }
}

/** R6: reprogramar solo en PENDIENTE o CONFIRMADA. */
export function validarReprogramable(codigo: string, estado: EstadoCita): void {
  validarModificable(codigo, estado);
  if (!ESTADOS_ACTIVOS.includes(estado)) {
    throw new ConflictException(
      `La cita ${codigo} no se puede reprogramar en estado ${ESTADO_LABELS[estado]}.`,
    );
  }
}

/** R8: cancelar exige motivo; el paciente solo hasta 2 horas antes. */
export function validarCancelacion(
  rol: Role,
  motivo: string | undefined,
  fechaHora: Date,
  ahora: Date,
): string {
  const limpio = motivo?.trim();
  if (!limpio) {
    throw new BadRequestException('Debes indicar el motivo de la cancelación.');
  }
  if (
    rol === Role.PACIENTE &&
    fechaHora.getTime() - ahora.getTime() <
      HORAS_MIN_CANCELACION_PACIENTE * HORA_MS
  ) {
    throw new BadRequestException(
      `Solo puedes cancelar hasta ${HORAS_MIN_CANCELACION_PACIENTE} horas antes de la cita. Comunícate con el centro médico.`,
    );
  }
  return limpio;
}

/** R9: ATENDIDA exige notas; cerrar solo después de la hora de la cita. */
export function validarCierre(
  resultado: EstadoCita,
  notas: string | undefined,
  fechaHora: Date,
  ahora: Date,
): string | null {
  if (fechaHora.getTime() > ahora.getTime()) {
    throw new BadRequestException(
      `La cita solo se puede cerrar después de su hora (${formatoRd(fechaHora)}).`,
    );
  }
  const limpias = notas?.trim() || null;
  if (resultado === EstadoCita.ATENDIDA && !limpias) {
    throw new BadRequestException(
      'Para marcar la cita como atendida debes escribir las notas de cierre.',
    );
  }
  return limpias;
}
