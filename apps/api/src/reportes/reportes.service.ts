import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoCita, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { ESTADO_LABELS } from '../citas/cita-rules';
import {
  esFechaValida,
  finDiaRd,
  inicioDiaRd,
  partesRd,
  sumarDias,
} from '../common/rd-time';
import { PrismaService } from '../prisma/prisma.service';
import { ReporteCitasQueryDto } from './dto/reportes.dto';

const ESTADOS = Object.values(EstadoCita);
type ConteoEstados = Record<EstadoCita, number>;

const vacio = (): ConteoEstados =>
  Object.fromEntries(ESTADOS.map((e) => [e, 0])) as ConteoEstados;

/** Fracción entre 0 y 1 con 4 decimales, o null si no hay base de cálculo. */
const tasa = (parte: number, base: number) =>
  base === 0 ? null : Math.round((parte / base) * 10_000) / 10_000;

const redondear = (n: number) => Math.round(n * 100) / 100;

export interface ReporteCitas {
  filtros: {
    desde: string | null;
    hasta: string | null;
    centroId: string | null;
    medicoId: string | null;
  };
  generadoEn: string;
  total: number;
  porEstado: ConteoEstados;
  /** ATENDIDAS / (ATENDIDAS + NO_ASISTIO) */
  tasaAsistencia: number | null;
  /** CANCELADAS / total */
  tasaCancelacion: number | null;
  /** Suma del costo de las citas ATENDIDAS (DOP) */
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
  citas: {
    codigo: string;
    fechaHora: Date;
    estado: EstadoCita;
    tipo: string;
    costo: number;
    paciente: string;
    medico: string;
    especialidad: string;
    centro: string;
  }[];
}

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async citas(
    actor: AuthUser,
    query: ReporteCitasQueryDto,
  ): Promise<ReporteCitas> {
    for (const f of [query.desde, query.hasta]) {
      if (f && !esFechaValida(f)) {
        throw new BadRequestException('La fecha no es válida.');
      }
    }
    if (query.desde && query.hasta && query.desde > query.hasta) {
      throw new BadRequestException(
        'La fecha "desde" no puede ser posterior a "hasta".',
      );
    }
    // El centro solo ve el reporte de su propio centro
    const centroId =
      actor.role === Role.CENTRO_MEDICO ? actor.id : (query.centroId ?? null);

    const where: Prisma.CitaWhereInput = {};
    if (centroId) where.centroId = centroId;
    if (query.medicoId) where.medicoId = query.medicoId;
    if (query.desde || query.hasta) {
      where.fechaHora = {
        gte: query.desde ? inicioDiaRd(query.desde) : undefined,
        lte: query.hasta ? finDiaRd(query.hasta) : undefined,
      };
    }

    const citas = await this.prisma.cita.findMany({
      where,
      orderBy: [{ fechaHora: 'asc' }, { codigo: 'asc' }],
      select: {
        codigo: true,
        fechaHora: true,
        estado: true,
        tipo: true,
        costo: true,
        paciente: { select: { fullName: true } },
        medico: { select: { id: true, nombre: true, especialidad: true } },
        centro: { select: { fullName: true } },
      },
    });

    const porEstado = vacio();
    let ingresos = 0;
    const medicos = new Map<string, ReporteCitas['porMedico'][number]>();
    const dias = new Map<string, ReporteCitas['porDia'][number]>();

    // Con un rango acotado se muestran también los días sin citas
    if (query.desde && query.hasta) {
      for (
        let f = query.desde, i = 0;
        f <= query.hasta && i < 370;
        f = sumarDias(f, 1), i++
      ) {
        dias.set(f, { fecha: f, total: 0, porEstado: vacio() });
      }
    }

    for (const c of citas) {
      const costo = Number(c.costo);
      porEstado[c.estado]++;
      if (c.estado === EstadoCita.ATENDIDA) ingresos += costo;

      let m = medicos.get(c.medico.id);
      if (!m) {
        m = {
          medicoId: c.medico.id,
          nombre: c.medico.nombre,
          especialidad: c.medico.especialidad,
          centro: c.centro.fullName,
          total: 0,
          porEstado: vacio(),
          tasaAsistencia: null,
          ingresos: 0,
        };
        medicos.set(c.medico.id, m);
      }
      m.total++;
      m.porEstado[c.estado]++;
      if (c.estado === EstadoCita.ATENDIDA) m.ingresos += costo;

      const fecha = partesRd(c.fechaHora).fecha;
      let d = dias.get(fecha);
      if (!d) {
        d = { fecha, total: 0, porEstado: vacio() };
        dias.set(fecha, d);
      }
      d.total++;
      d.porEstado[c.estado]++;
    }

    const porMedico = [...medicos.values()]
      .map((m) => ({
        ...m,
        ingresos: redondear(m.ingresos),
        tasaAsistencia: tasa(
          m.porEstado.ATENDIDA,
          m.porEstado.ATENDIDA + m.porEstado.NO_ASISTIO,
        ),
      }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));

    return {
      filtros: {
        desde: query.desde ?? null,
        hasta: query.hasta ?? null,
        centroId,
        medicoId: query.medicoId ?? null,
      },
      generadoEn: new Date().toISOString(),
      total: citas.length,
      porEstado,
      tasaAsistencia: tasa(
        porEstado.ATENDIDA,
        porEstado.ATENDIDA + porEstado.NO_ASISTIO,
      ),
      tasaCancelacion: tasa(porEstado.CANCELADA, citas.length),
      ingresos: redondear(ingresos),
      porMedico,
      porDia: [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
      citas: citas.map((c) => ({
        codigo: c.codigo,
        fechaHora: c.fechaHora,
        estado: c.estado,
        tipo: c.tipo,
        costo: Number(c.costo),
        paciente: c.paciente.fullName,
        medico: c.medico.nombre,
        especialidad: c.medico.especialidad,
        centro: c.centro.fullName,
      })),
    };
  }

  /** CSV (UTF-8 con BOM para Excel): resumen, por médico, por día y detalle. */
  toCsv(r: ReporteCitas): string {
    const pct = (v: number | null) =>
      v === null ? 'N/D' : `${(v * 100).toFixed(1)}%`;
    const filas: (string | number)[][] = [
      ['Reporte de citas - MediCita RD'],
      ['Desde', r.filtros.desde ?? 'inicio'],
      ['Hasta', r.filtros.hasta ?? 'hoy en adelante'],
      ['Generado', r.generadoEn],
      [],
      ['Resumen'],
      ['Total de citas', r.total],
      ...ESTADOS.map((e) => [ESTADO_LABELS[e], r.porEstado[e]]),
      ['Tasa de asistencia', pct(r.tasaAsistencia)],
      ['Tasa de cancelación', pct(r.tasaCancelacion)],
      ['Ingresos de citas atendidas (DOP)', r.ingresos.toFixed(2)],
      [],
      ['Por médico'],
      [
        'Médico',
        'Especialidad',
        'Centro',
        'Total',
        ...ESTADOS.map((e) => ESTADO_LABELS[e]),
        'Tasa de asistencia',
        'Ingresos (DOP)',
      ],
      ...r.porMedico.map((m) => [
        m.nombre,
        m.especialidad,
        m.centro,
        m.total,
        ...ESTADOS.map((e) => m.porEstado[e]),
        pct(m.tasaAsistencia),
        m.ingresos.toFixed(2),
      ]),
      [],
      ['Por día'],
      ['Fecha', 'Total', ...ESTADOS.map((e) => ESTADO_LABELS[e])],
      ...r.porDia.map((d) => [
        d.fecha,
        d.total,
        ...ESTADOS.map((e) => d.porEstado[e]),
      ]),
      [],
      ['Detalle de citas'],
      [
        'Código',
        'Fecha y hora (RD)',
        'Estado',
        'Tipo',
        'Paciente',
        'Médico',
        'Especialidad',
        'Centro',
        'Costo (DOP)',
      ],
      ...r.citas.map((c) => {
        const p = partesRd(c.fechaHora);
        const hora = `${String(Math.floor(p.minutos / 60)).padStart(2, '0')}:${String(p.minutos % 60).padStart(2, '0')}`;
        return [
          c.codigo,
          `${p.fecha} ${hora}`,
          ESTADO_LABELS[c.estado],
          c.tipo,
          c.paciente,
          c.medico,
          c.especialidad,
          c.centro,
          c.costo.toFixed(2),
        ];
      }),
    ];
    return '\uFEFF' + filas.map((f) => f.map(csvCelda).join(',')).join('\r\n');
  }
}

function csvCelda(valor: string | number): string {
  const s = String(valor);
  // Comillas si hace falta y neutraliza fórmulas al abrir en Excel
  const seguro = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}
