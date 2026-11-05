import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Medico, Prisma, Role } from '@prisma/client';
import { AuditAction } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { DIAS_MAX_ANTICIPACION, ESTADOS_ACTIVOS } from '../citas/cita-rules';
import {
  describirDias,
  esFechaValida,
  finDiaRd,
  horaAMinutos,
  inicioDiaRd,
  instanteRd,
  minutosAHora,
  partesRd,
} from '../common/rd-time';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMedicoDto,
  ListMedicosQueryDto,
  UpdateMedicoDto,
} from './dto/medicos.dto';

export const MEDICO_AJENO =
  'Acceso denegado: este médico pertenece a otro centro.';

const MEDICO_INCLUDE = {
  centro: { select: { id: true, fullName: true } },
} satisfies Prisma.MedicoInclude;

type MedicoConCentro = Prisma.MedicoGetPayload<{
  include: typeof MEDICO_INCLUDE;
}>;

/** Respuesta pública de un médico (precio como número). */
export function medicoPublico(m: MedicoConCentro) {
  return {
    id: m.id,
    nombre: m.nombre,
    especialidad: m.especialidad,
    precioConsulta: Number(m.precioConsulta),
    duracionMin: m.duracionMin,
    diasSemana: [...m.diasSemana].sort((a, b) => a - b),
    horaInicio: m.horaInicio,
    horaFin: m.horaFin,
    horarioTexto: `${describirDias(m.diasSemana)}, ${m.horaInicio} a ${m.horaFin}`,
    activo: m.activo,
    centro: m.centro,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

@Injectable()
export class MedicosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * El centro ve todos sus médicos (también los inactivos); el paciente solo
   * los activos; el admin todos.
   */
  async list(actor: AuthUser, query: ListMedicosQueryDto) {
    const where: Prisma.MedicoWhereInput = {};
    if (actor.role === Role.CENTRO_MEDICO) where.centroId = actor.id;
    else if (query.centroId) where.centroId = query.centroId;
    if (actor.role === Role.PACIENTE) where.activo = true;
    if (query.especialidad) {
      where.especialidad = { equals: query.especialidad, mode: 'insensitive' };
    }
    if (query.texto) {
      where.OR = [
        { nombre: { contains: query.texto, mode: 'insensitive' } },
        { especialidad: { contains: query.texto, mode: 'insensitive' } },
        {
          centro: { fullName: { contains: query.texto, mode: 'insensitive' } },
        },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.medico.findMany({
        where,
        include: MEDICO_INCLUDE,
        orderBy: [
          { activo: 'desc' },
          { especialidad: 'asc' },
          { nombre: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.medico.count({ where }),
    ]);
    return {
      items: items.map(medicoPublico),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Especialidades con al menos un médico activo (filtro de búsqueda). */
  async especialidades(actor: AuthUser) {
    const rows = await this.prisma.medico.findMany({
      where:
        actor.role === Role.CENTRO_MEDICO
          ? { centroId: actor.id }
          : { activo: true },
      distinct: ['especialidad'],
      select: { especialidad: true },
      orderBy: { especialidad: 'asc' },
    });
    return rows.map((r) => r.especialidad);
  }

  async get(actor: AuthUser, id: string, ip: string | null) {
    const medico = await this.findOrFail(id);
    if (actor.role === Role.CENTRO_MEDICO && medico.centroId !== actor.id) {
      throw await this.denegar(actor, medico, ip);
    }
    if (actor.role === Role.PACIENTE && !medico.activo) {
      throw new NotFoundException('Médico no encontrado o no disponible.');
    }
    return medicoPublico(medico);
  }

  async create(actor: AuthUser, dto: CreateMedicoDto, ip: string | null) {
    const duracionMin = dto.duracionMin ?? 30;
    this.validarHorario(dto.horaInicio, dto.horaFin, duracionMin);
    const medico = await this.prisma.medico.create({
      data: {
        centroId: actor.id,
        nombre: dto.nombre,
        especialidad: dto.especialidad,
        precioConsulta: dto.precioConsulta,
        duracionMin,
        diasSemana: [...dto.diasSemana].sort((a, b) => a - b),
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
      },
      include: MEDICO_INCLUDE,
    });
    await this.audit.record({
      action: AuditAction.MEDICO_CREADO,
      userId: actor.id,
      detail: `${actor.email} registró a ${medico.nombre} (${medico.especialidad})`,
      ip,
    });
    return medicoPublico(medico);
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateMedicoDto,
    ip: string | null,
  ) {
    const actual = await this.findOwned(actor, id, ip);
    const horaInicio = dto.horaInicio ?? actual.horaInicio;
    const horaFin = dto.horaFin ?? actual.horaFin;
    const duracionMin = dto.duracionMin ?? actual.duracionMin;
    this.validarHorario(horaInicio, horaFin, duracionMin);

    const data: Prisma.MedicoUpdateInput = { ...dto };
    if (dto.diasSemana) {
      data.diasSemana = [...dto.diasSemana].sort((a, b) => a - b);
    }
    const medico = await this.prisma.medico.update({
      where: { id },
      data,
      include: MEDICO_INCLUDE,
    });
    const campos = Object.keys(dto).join(', ') || 'sin cambios';
    await this.audit.record({
      action: AuditAction.MEDICO_ACTUALIZADO,
      userId: actor.id,
      detail: `${actor.email} actualizó a ${medico.nombre}: ${campos}`,
      ip,
    });
    return medicoPublico(medico);
  }

  async setActivo(
    actor: AuthUser,
    id: string,
    activo: boolean,
    ip: string | null,
  ) {
    const actual = await this.findOwned(actor, id, ip);
    if (actual.activo === activo) {
      throw new BadRequestException(
        activo ? 'El médico ya está activo.' : 'El médico ya está inactivo.',
      );
    }
    const medico = await this.prisma.medico.update({
      where: { id },
      data: { activo },
      include: MEDICO_INCLUDE,
    });
    await this.audit.record({
      action: activo
        ? AuditAction.MEDICO_ACTIVADO
        : AuditAction.MEDICO_DESACTIVADO,
      userId: actor.id,
      detail: `${actor.email} ${activo ? 'activó' : 'desactivó'} a ${medico.nombre}`,
      ip,
    });
    return medicoPublico(medico);
  }

  /**
   * Turnos del día (hora de RD) con su disponibilidad. Un turno no está
   * disponible si ya pasó, supera los 90 días o tiene una cita activa.
   */
  async disponibilidad(
    actor: AuthUser,
    id: string,
    fecha: string,
    ip: string | null,
  ) {
    if (!esFechaValida(fecha)) {
      throw new BadRequestException('La fecha no es válida.');
    }
    const medico = await this.findOrFail(id);
    if (actor.role === Role.CENTRO_MEDICO && medico.centroId !== actor.id) {
      throw await this.denegar(actor, medico, ip);
    }
    const dia = partesRd(instanteRd(fecha, 12 * 60)).diaSemana;
    const base = {
      fecha,
      medico: medicoPublico(medico),
      atiende: medico.activo && medico.diasSemana.includes(dia),
    };
    if (!base.atiende) return { ...base, slots: [] };

    const ocupadas = await this.prisma.cita.findMany({
      where: {
        medicoId: id,
        estado: { in: ESTADOS_ACTIVOS },
        fechaHora: { gte: inicioDiaRd(fecha), lte: finDiaRd(fecha) },
      },
      select: { fechaHora: true },
    });
    const tomadas = new Set(ocupadas.map((c) => c.fechaHora.getTime()));
    const ahora = Date.now();
    const limite = ahora + DIAS_MAX_ANTICIPACION * 86_400_000;

    const slots: {
      hora: string;
      fechaHora: string;
      disponible: boolean;
      motivo?: string;
    }[] = [];
    const fin = horaAMinutos(medico.horaFin);
    for (
      let m = horaAMinutos(medico.horaInicio);
      m + medico.duracionMin <= fin;
      m += medico.duracionMin
    ) {
      const instante = instanteRd(fecha, m);
      const t = instante.getTime();
      let motivo: string | undefined;
      if (t <= ahora) motivo = 'pasado';
      else if (t > limite) motivo = 'fuera de rango';
      else if (tomadas.has(t)) motivo = 'ocupado';
      slots.push({
        hora: minutosAHora(m),
        fechaHora: instante.toISOString(),
        disponible: !motivo,
        ...(motivo ? { motivo } : {}),
      });
    }
    return { ...base, slots };
  }

  private validarHorario(inicio: string, fin: string, duracion: number) {
    if (horaAMinutos(fin) - horaAMinutos(inicio) < duracion) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la de inicio y dejar espacio para al menos un turno.',
      );
    }
  }

  private async findOrFail(id: string): Promise<MedicoConCentro> {
    const medico = await this.prisma.medico.findUnique({
      where: { id },
      include: MEDICO_INCLUDE,
    });
    if (!medico) throw new NotFoundException('Médico no encontrado.');
    return medico;
  }

  /** El centro solo gestiona sus propios médicos. */
  private async findOwned(
    actor: AuthUser,
    id: string,
    ip: string | null,
  ): Promise<Medico> {
    const medico = await this.findOrFail(id);
    if (medico.centroId !== actor.id) {
      throw await this.denegar(actor, medico, ip);
    }
    return medico;
  }

  private denegar(actor: AuthUser, medico: Medico, ip: string | null) {
    return this.audit.forbidden(
      actor,
      `el médico ${medico.nombre} (${medico.id})`,
      MEDICO_AJENO,
      ip,
    );
  }
}
