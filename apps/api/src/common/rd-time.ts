/**
 * Utilidades de fecha y hora en República Dominicana.
 *
 * RD usa UTC−4 todo el año (no tiene horario de verano), así que se trabaja
 * con un desfase fijo. En la base las fechas se guardan en UTC; los horarios
 * de los médicos, los turnos y los "días" de los filtros y reportes se
 * interpretan en hora local de RD.
 */
export const RD_OFFSET_MIN = -240;
const OFFSET_MS = RD_OFFSET_MIN * 60_000;
const DAY_MS = 86_400_000;

export const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const NOMBRES_DIAS = [
  '',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];

const pad = (n: number) => String(n).padStart(2, '0');

export interface PartesRd {
  /** YYYY-MM-DD en hora de RD */
  fecha: string;
  /** Minutos desde la medianoche local */
  minutos: number;
  /** 1 = lunes … 7 = domingo */
  diaSemana: number;
}

/** Descompone un instante en fecha, minutos y día de la semana de RD. */
export function partesRd(date: Date): PartesRd {
  const local = new Date(date.getTime() + OFFSET_MS);
  const dow = local.getUTCDay();
  return {
    fecha: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    minutos: local.getUTCHours() * 60 + local.getUTCMinutes(),
    diaSemana: dow === 0 ? 7 : dow,
  };
}

/** Instante UTC de una fecha (YYYY-MM-DD) y minutos locales de RD. */
export function instanteRd(fecha: string, minutos = 0): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minutos) - OFFSET_MS);
}

/** Inicio (00:00) del día de RD. */
export const inicioDiaRd = (fecha: string) => instanteRd(fecha, 0);
/** Último milisegundo del día de RD. */
export const finDiaRd = (fecha: string) =>
  new Date(instanteRd(fecha, 0).getTime() + DAY_MS - 1);

/** Fecha válida del calendario (rechaza 2026-02-31). */
export function esFechaValida(fecha: string): boolean {
  if (!FECHA_REGEX.test(fecha)) return false;
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function minutosAHora(minutos: number): string {
  return `${pad(Math.floor(minutos / 60))}:${pad(minutos % 60)}`;
}

/** Suma días a una fecha YYYY-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  return partesRd(
    new Date(instanteRd(fecha, 12 * 60).getTime() + dias * DAY_MS),
  ).fecha;
}

/** "lun 10/11/2026 08:30" en hora de RD (para mensajes e historial). */
export function formatoRd(date: Date): string {
  const local = new Date(date.getTime() + OFFSET_MS);
  return `${DIAS_CORTOS[local.getUTCDay()]} ${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/** "lunes a viernes" o "lunes, miércoles y viernes". */
export function describirDias(dias: number[]): string {
  const orden = [...new Set(dias)].sort((a, b) => a - b);
  if (orden.length === 0) return 'ningún día';
  const consecutivos = orden.every((d, i) => i === 0 || d === orden[i - 1] + 1);
  if (orden.length >= 3 && consecutivos) {
    return `${NOMBRES_DIAS[orden[0]]} a ${NOMBRES_DIAS[orden[orden.length - 1]]}`;
  }
  const nombres = orden.map((d) => NOMBRES_DIAS[d]);
  return nombres.length === 1
    ? nombres[0]
    : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}
