/** Tipos y utilidades compartidas de médicos, citas y reportes (Épica 2). */

export const ESTADOS = ["PENDIENTE", "CONFIRMADA", "ATENDIDA", "NO_ASISTIO", "CANCELADA"] as const;
export type EstadoCita = (typeof ESTADOS)[number];
export type TipoCita = "CONSULTA" | "ESTUDIO";
export type AccionCita =
  "CREADA" | "ACTUALIZADA" | "REPROGRAMADA" | "CONFIRMADA" | "CERRADA" | "CANCELADA";

export const ESTADOS_ACTIVOS: EstadoCita[] = ["PENDIENTE", "CONFIRMADA"];
export const ESTADOS_CERRADOS: EstadoCita[] = ["ATENDIDA", "NO_ASISTIO", "CANCELADA"];

/** Colores de estado: Pendiente amarillo, Confirmada azul, Atendida verde, No asistió gris, Cancelada rojo. */
export const ESTADO_INFO: Record<
  EstadoCita,
  { label: string; badge: string; bar: string; dot: string }
> = {
  PENDIENTE: {
    label: "Pendiente",
    badge: "bg-warning/20 text-[#8a5d00]",
    bar: "bg-warning",
    dot: "bg-warning",
  },
  CONFIRMADA: {
    label: "Confirmada",
    badge: "bg-brand-soft text-brand",
    bar: "bg-brand",
    dot: "bg-brand",
  },
  ATENDIDA: {
    label: "Atendida",
    badge: "bg-success/15 text-success",
    bar: "bg-success",
    dot: "bg-success",
  },
  NO_ASISTIO: {
    label: "No asistió",
    badge: "bg-slate-200 text-slate-700",
    bar: "bg-slate-500",
    dot: "bg-slate-500",
  },
  CANCELADA: {
    label: "Cancelada",
    badge: "bg-destructive/10 text-destructive",
    bar: "bg-destructive",
    dot: "bg-destructive",
  },
};

export const TIPO_LABELS: Record<TipoCita, string> = {
  CONSULTA: "Consulta",
  ESTUDIO: "Estudio",
};

export const ACCION_LABELS: Record<AccionCita, string> = {
  CREADA: "Cita creada",
  ACTUALIZADA: "Datos actualizados",
  REPROGRAMADA: "Cita reprogramada",
  CONFIRMADA: "Cita confirmada",
  CERRADA: "Cita cerrada",
  CANCELADA: "Cita cancelada",
};

export const DIAS = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export interface Medico {
  id: string;
  nombre: string;
  especialidad: string;
  precioConsulta: number;
  duracionMin: number;
  diasSemana: number[];
  horaInicio: string;
  horaFin: string;
  horarioTexto: string;
  activo: boolean;
  centro: { id: string; fullName: string };
}

export interface Cita {
  id: string;
  codigo: string;
  pacienteId: string;
  medicoId: string;
  centroId: string;
  fechaHora: string;
  tipo: TipoCita;
  motivo: string;
  estado: EstadoCita;
  costo: number;
  notasCierre: string | null;
  motivoCancelacion: string | null;
  createdAt: string;
  updatedAt: string;
  paciente: { id: string; fullName: string; email: string };
  medico: {
    id: string;
    nombre: string;
    especialidad: string;
    duracionMin: number;
    diasSemana: number[];
    activo: boolean;
  };
  centro: { id: string; fullName: string };
}

export interface HistorialItem {
  id: string;
  accion: AccionCita;
  estadoAnterior: EstadoCita | null;
  estadoNuevo: EstadoCita | null;
  cambios: Record<string, { antes: unknown; despues: unknown }> | null;
  comentario: string | null;
  createdAt: string;
  usuario: { id: string; fullName: string; role: string } | null;
}

export interface Slot {
  hora: string;
  fechaHora: string;
  disponible: boolean;
  motivo?: string;
}

export interface Disponibilidad {
  fecha: string;
  medico: Medico;
  atiende: boolean;
  slots: Slot[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ConteoEstados = Record<EstadoCita, number>;

export interface Reporte {
  filtros: {
    desde: string | null;
    hasta: string | null;
    centroId: string | null;
    medicoId: string | null;
  };
  generadoEn: string;
  total: number;
  porEstado: ConteoEstados;
  tasaAsistencia: number | null;
  tasaCancelacion: number | null;
  ingresos: number;
  porMedico: {
    medicoId: string;
    nombre: string;
    especialidad: string;
    centro: string;
    total: number;
    porEstado: ConteoEstados;
    tasaAsistencia: number | null;
    ingresos: number;
  }[];
  porDia: { fecha: string; total: number; porEstado: ConteoEstados }[];
}

// ─── Fechas en hora de República Dominicana ─────────────────────────

export const RD_TZ = "America/Santo_Domingo";

const fmtFecha = new Intl.DateTimeFormat("es-DO", {
  timeZone: RD_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const fmtFechaLarga = new Intl.DateTimeFormat("es-DO", {
  timeZone: RD_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const fmtHora = new Intl.DateTimeFormat("es-DO", {
  timeZone: RD_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});
const fmtFechaHora = new Intl.DateTimeFormat("es-DO", {
  timeZone: RD_TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});
const fmtYmd = new Intl.DateTimeFormat("en-CA", {
  timeZone: RD_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Node (servidor) y el navegador pueden usar versiones distintas de ICU: una
 * escribe "10:30 a. m." con espacios especiales y la otra con espacios
 * normales. Se normalizan para que el HTML del servidor y del cliente coincida.
 */
const ESPACIOS_ESPECIALES = /[\u00a0\u202f]/g;
const limpiar = (s: string) => s.replace(ESPACIOS_ESPECIALES, " ");

export const formatFecha = (iso: string | Date) => limpiar(fmtFecha.format(new Date(iso)));
export const formatFechaLarga = (iso: string | Date) =>
  limpiar(fmtFechaLarga.format(new Date(iso)));
export const formatHora = (iso: string | Date) => limpiar(fmtHora.format(new Date(iso)));
export const formatFechaHora = (iso: string | Date) =>
  limpiar(fmtFechaHora.format(new Date(iso)));

/** "2026-11-05" → "jue, 5 nov 2026" (fecha de calendario, sin desfase). */
export function formatDia(ymd: string) {
  return limpiar(fmtFecha.format(new Date(`${ymd}T12:00:00-04:00`)));
}

/** Fecha de hoy (AAAA-MM-DD) en RD. */
export function hoyRd(): string {
  return fmtYmd.format(new Date());
}

/** Fecha (AAAA-MM-DD) en RD de un instante. */
export function ymdRd(iso: string | Date): string {
  return fmtYmd.format(new Date(iso));
}

export function sumarDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** 1 = lunes … 7 = domingo para una fecha AAAA-MM-DD. */
export function diaSemana(ymd: string): number {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return dow === 0 ? 7 : dow;
}

const fmtDop = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
export const formatDop = (n: number) => limpiar(fmtDop.format(n));

export const formatPct = (v: number | null) =>
  v === null ? "N/D" : `${(v * 100).toLocaleString("es-DO", { maximumFractionDigits: 1 })} %`;

export const esCerrada = (estado: EstadoCita) => ESTADOS_CERRADOS.includes(estado);

/** Horas que faltan para la cita (negativo si ya pasó). */
export const horasParaCita = (iso: string) => (new Date(iso).getTime() - Date.now()) / 3_600_000;
