import { EstadoCita, Medico, Prisma } from '@prisma/client';
import { partesRd, sumarDias, instanteRd } from '../src/common/rd-time';
import { PrismaService } from '../src/prisma/prisma.service';

/** Crea un médico (L-V, 08:00 a 17:00, turnos de 30 min) directamente en la base. */
export function createMedico(
  prisma: PrismaService,
  centroId: string,
  data: Partial<Prisma.MedicoUncheckedCreateInput> = {},
): Promise<Medico> {
  return prisma.medico.create({
    data: {
      centroId,
      nombre: 'Dra. Laura Fernández',
      especialidad: 'Medicina General',
      precioConsulta: 1500,
      duracionMin: 30,
      diasSemana: [1, 2, 3, 4, 5],
      horaInicio: '08:00',
      horaFin: '17:00',
      ...data,
    },
  });
}

/** Día hábil (lunes a viernes) a `dias` o más de hoy, en hora de RD (AAAA-MM-DD). */
export function diaHabil(dias: number): string {
  let fecha = sumarDias(partesRd(new Date()).fecha, dias);
  while (partesRd(instanteRd(fecha, 12 * 60)).diaSemana > 5) {
    fecha = sumarDias(fecha, 1);
  }
  return fecha;
}

/** Sábado próximo (para probar R2). */
export function proximoSabado(): string {
  let fecha = sumarDias(partesRd(new Date()).fecha, 1);
  while (partesRd(instanteRd(fecha, 12 * 60)).diaSemana !== 6) {
    fecha = sumarDias(fecha, 1);
  }
  return fecha;
}

/** "2026-11-09T09:00:00-04:00" */
export const turno = (fecha: string, hora: string) =>
  `${fecha}T${hora}:00-04:00`;

/** Inserta una cita sin pasar por las reglas (para escenarios en el pasado). */
export function insertCita(
  prisma: PrismaService,
  data: {
    pacienteId: string;
    medico: Medico;
    fechaHora: Date;
    estado?: EstadoCita;
    costo?: number;
    motivo?: string;
  },
) {
  return prisma.cita.create({
    data: {
      pacienteId: data.pacienteId,
      medicoId: data.medico.id,
      centroId: data.medico.centroId,
      fechaHora: data.fechaHora,
      estado: data.estado ?? 'PENDIENTE',
      motivo: data.motivo ?? 'Cita de prueba',
      costo: data.costo ?? data.medico.precioConsulta,
    },
  });
}

export const HORA_MS = 3_600_000;
