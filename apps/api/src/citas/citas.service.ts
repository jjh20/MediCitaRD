import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccionCita,
  Cita,
  EstadoCita,
  Medico,
  Prisma,
  Role,
} from '@prisma/client';
import { AuditAction } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { finDiaRd, formatoRd, inicioDiaRd } from '../common/rd-time';
import { PrismaService } from '../prisma/prisma.service';
import {
  ESTADO_LABELS,
  ESTADOS_ACTIVOS,
  validarCancelacion,
  validarCierre,
  validarHorario,
  validarMedicoActivo,
  validarModificable,
  validarReprogramable,
  validarTransicion,
  validarVentana,
} from './cita-rules';
import {
  CerrarCitaDto,
  CreateCitaDto,
  ListCitasQueryDto,
  ReprogramarCitaDto,
  UpdateCitaDto,
} from './dto/citas.dto';

type Tx = Prisma.TransactionClient;

export const CITA_AJENA = 'Acceso denegado: esta cita no te pertenece.';
export const HORARIO_TOMADO =
  'Ese horario acaba de ser reservado por otra persona. Elige otro horario.';
export const CITA_CAMBIO_CONCURRENTE =
  'La cita fue modificada por otra persona al mismo tiempo. Recarga la página e intenta de nuevo.';

export const CITA_INCLUDE = {
  paciente: { select: { id: true, fullName: true, email: true } },
  medico: {
    select: {
      id: true,
      nombre: true,
      especialidad: true,
      duracionMin: true,
      diasSemana: true,
      activo: true,
    },
  },
  centro: { select: { id: true, fullName: true } },
} satisfies Prisma.CitaInclude;

type CitaCompleta = Prisma.CitaGetPayload<{ include: typeof CITA_INCLUDE }>;

/** Respuesta pública de una cita (costo como número). */
export function citaPublica(c: CitaCompleta) {
  return { ...c, costo: Number(c.costo) };
}

type Cambios = Record<string, { antes: unknown; despues: unknown }>;

interface Preparado {
  data: Prisma.CitaUpdateManyMutationInput;
  estadoNuevo?: EstadoCita;
  cambios?: Cambios;
  comentario?: string | null;
  /** Texto para la auditoría */
  detalle: string;
}

@Injectable()
export class CitasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Reloj inyectable para las pruebas. */
  now(): Date {
    return new Date();
  }

  // ─── Consultas ─────────────────────────────────────────────────────

  async list(actor: AuthUser, query: ListCitasQueryDto) {
    const where: Prisma.CitaWhereInput = {};
    if (actor.role === Role.PACIENTE) {
      where.pacienteId = actor.id;
    } else if (actor.role === Role.CENTRO_MEDICO) {
      where.centroId = actor.id;
      if (query.pacienteId) where.pacienteId = query.pacienteId;
    } else {
      if (query.centroId) where.centroId = query.centroId;
      if (query.pacienteId) where.pacienteId = query.pacienteId;
    }
    if (query.medicoId) where.medicoId = query.medicoId;
    if (query.estado?.length) where.estado = { in: query.estado };
    if (query.desde || query.hasta) {
      where.fechaHora = {
        gte: query.desde ? inicioDiaRd(query.desde) : undefined,
        lte: query.hasta ? finDiaRd(query.hasta) : undefined,
      };
    }
    if (query.texto) {
      const t = { contains: query.texto, mode: 'insensitive' as const };
      where.OR = [
        { codigo: t },
        { motivo: t },
        { paciente: { fullName: t } },
        { paciente: { email: t } },
        { medico: { nombre: t } },
        { medico: { especialidad: t } },
      ];
    }
    const orden = query.orden ?? 'asc';
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cita.findMany({
        where,
        include: CITA_INCLUDE,
        orderBy: [{ fechaHora: orden }, { codigo: orden }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.cita.count({ where }),
    ]);
    return {
      items: items.map(citaPublica),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(actor: AuthUser, id: string, ip: string | null) {
    await this.cargar(actor, id, ip);
    const cita = await this.prisma.cita.findUniqueOrThrow({
      where: { id },
      include: CITA_INCLUDE,
    });
    return citaPublica(cita);
  }

  /** Historial completo, del más antiguo al más reciente. */
  async historial(actor: AuthUser, id: string, ip: string | null) {
    await this.cargar(actor, id, ip);
    return this.prisma.citaHistorial.findMany({
      where: { citaId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        usuario: { select: { id: true, fullName: true, role: true } },
      },
    });
  }

  // ─── Operaciones ───────────────────────────────────────────────────

  async create(actor: AuthUser, dto: CreateCitaDto, ip: string | null) {
    const fechaHora = new Date(dto.fechaHora);
    validarVentana(fechaHora, this.now()); // R1

    const cita = await this.enTransaccion(async (tx) => {
      const medico = await tx.medico.findUnique({
        where: { id: dto.medicoId },
      });
      if (!medico) throw new NotFoundException('Médico no encontrado.');
      validarMedicoActivo(medico); // R5
      validarHorario(medico, fechaHora); // R2
      await this.validarChoques(tx, actor, {
        medico,
        pacienteId: actor.id,
        fechaHora,
      }); // R3, R4

      const creada = await tx.cita.create({
        data: {
          pacienteId: actor.id,
          medicoId: medico.id,
          centroId: medico.centroId,
          fechaHora,
          tipo: dto.tipo,
          motivo: dto.motivo,
          costo: medico.precioConsulta,
        },
        include: CITA_INCLUDE,
      });
      await this.registrar(tx, {
        citaId: creada.id,
        usuarioId: actor.id,
        accion: AccionCita.CREADA,
        estadoNuevo: EstadoCita.PENDIENTE,
        comentario: `Cita agendada con ${medico.nombre} para el ${formatoRd(fechaHora)}.`,
      });
      return creada;
    }, HORARIO_TOMADO);

    await this.audit.record({
      action: AuditAction.CITA_CREADA,
      userId: actor.id,
      detail: `${actor.email} agendó ${cita.codigo} con ${cita.medico.nombre} para el ${formatoRd(fechaHora)}`,
      ip,
    });
    return citaPublica(cita);
  }

  /** PATCH: motivo y tipo (R7: no si está cerrada). */
  update(actor: AuthUser, id: string, dto: UpdateCitaDto, ip: string | null) {
    return this.aplicar(actor, id, ip, {
      accion: AccionCita.ACTUALIZADA,
      auditoria: AuditAction.CITA_ACTUALIZADA,
      preparar: (cita) => {
        validarModificable(cita.codigo, cita.estado);
        const cambios: Cambios = {};
        if (dto.motivo !== undefined && dto.motivo !== cita.motivo) {
          cambios.motivo = { antes: cita.motivo, despues: dto.motivo };
        }
        if (dto.tipo !== undefined && dto.tipo !== cita.tipo) {
          cambios.tipo = { antes: cita.tipo, despues: dto.tipo };
        }
        if (Object.keys(cambios).length === 0) {
          throw new BadRequestException('No hay cambios para guardar.');
        }
        return Promise.resolve({
          data: { motivo: dto.motivo, tipo: dto.tipo },
          cambios,
          detalle: `actualizó ${Object.keys(cambios).join(' y ')}`,
        });
      },
    });
  }

  /** R6: solo PENDIENTE o CONFIRMADA; vuelve a PENDIENTE. */
  reprogramar(
    actor: AuthUser,
    id: string,
    dto: ReprogramarCitaDto,
    ip: string | null,
  ) {
    const nueva = new Date(dto.fechaHora);
    return this.aplicar(
      actor,
      id,
      ip,
      {
        accion: AccionCita.REPROGRAMADA,
        auditoria: AuditAction.CITA_REPROGRAMADA,
        preparar: async (cita, tx) => {
          validarReprogramable(cita.codigo, cita.estado); // R6, R7
          if (nueva.getTime() === cita.fechaHora.getTime()) {
            throw new BadRequestException(
              'La nueva fecha y hora es igual a la actual.',
            );
          }
          validarVentana(nueva, this.now()); // R1
          validarMedicoActivo(cita.medico); // R5
          validarHorario(cita.medico, nueva); // R2
          await this.validarChoques(tx, actor, {
            medico: cita.medico,
            pacienteId: cita.pacienteId,
            fechaHora: nueva,
            excluirId: cita.id,
          }); // R3, R4
          return {
            data: { fechaHora: nueva, estado: EstadoCita.PENDIENTE },
            estadoNuevo: EstadoCita.PENDIENTE,
            cambios: {
              fechaHora: {
                antes: cita.fechaHora.toISOString(),
                despues: nueva.toISOString(),
              },
            },
            comentario:
              dto.comentario ||
              `Reprogramada del ${formatoRd(cita.fechaHora)} al ${formatoRd(nueva)}.`,
            detalle: `reprogramó del ${formatoRd(cita.fechaHora)} al ${formatoRd(nueva)}`,
          };
        },
      },
      HORARIO_TOMADO,
    );
  }

  confirmar(
    actor: AuthUser,
    id: string,
    comentario: string | undefined,
    ip: string | null,
  ) {
    return this.aplicar(actor, id, ip, {
      accion: AccionCita.CONFIRMADA,
      auditoria: AuditAction.CITA_CONFIRMADA,
      preparar: (cita) => {
        validarTransicion(cita.codigo, cita.estado, EstadoCita.CONFIRMADA);
        return Promise.resolve({
          data: { estado: EstadoCita.CONFIRMADA },
          estadoNuevo: EstadoCita.CONFIRMADA,
          comentario: comentario || null,
          detalle: 'confirmó la cita',
        });
      },
    });
  }

  /** R9: ATENDIDA (con notas) o NO_ASISTIO, después de la hora. */
  cerrar(actor: AuthUser, id: string, dto: CerrarCitaDto, ip: string | null) {
    const resultado = dto.resultado as EstadoCita;
    return this.aplicar(actor, id, ip, {
      accion: AccionCita.CERRADA,
      auditoria: AuditAction.CITA_CERRADA,
      preparar: (cita) => {
        validarTransicion(cita.codigo, cita.estado, resultado); // R6, R7
        const notas = validarCierre(
          resultado,
          dto.notas,
          cita.fechaHora,
          this.now(),
        ); // R9
        return Promise.resolve({
          data: { estado: resultado, notasCierre: notas },
          estadoNuevo: resultado,
          cambios: notas
            ? { notasCierre: { antes: cita.notasCierre, despues: notas } }
            : undefined,
          comentario: notas,
          detalle: `cerró la cita como ${ESTADO_LABELS[resultado]}`,
        });
      },
    });
  }

  /** R8: motivo obligatorio; el paciente hasta 2 horas antes. */
  cancelar(
    actor: AuthUser,
    id: string,
    motivo: string | undefined,
    ip: string | null,
  ) {
    return this.aplicar(actor, id, ip, {
      accion: AccionCita.CANCELADA,
      auditoria: AuditAction.CITA_CANCELADA,
      preparar: (cita) => {
        validarTransicion(cita.codigo, cita.estado, EstadoCita.CANCELADA);
        const limpio = validarCancelacion(
          actor.role,
          motivo,
          cita.fechaHora,
          this.now(),
        );
        return Promise.resolve({
          data: { estado: EstadoCita.CANCELADA, motivoCancelacion: limpio },
          estadoNuevo: EstadoCita.CANCELADA,
          cambios: {
            motivoCancelacion: { antes: null, despues: limpio },
          },
          comentario: limpio,
          detalle: `canceló la cita (${limpio})`,
        });
      },
    });
  }

  // ─── Internos ──────────────────────────────────────────────────────

  /**
   * Plantilla común de las operaciones sobre una cita: verifica el acceso
   * (403 auditado), valida y actualiza dentro de una transacción serializable
   * con bloqueo optimista, escribe el historial en la misma transacción y
   * registra la auditoría.
   */
  private async aplicar(
    actor: AuthUser,
    id: string,
    ip: string | null,
    op: {
      accion: AccionCita;
      auditoria: AuditAction;
      preparar: (cita: Cita & { medico: Medico }, tx: Tx) => Promise<Preparado>;
    },
    mensajeConflicto = CITA_CAMBIO_CONCURRENTE,
  ) {
    await this.cargar(actor, id, ip);
    const { cita, detalle } = await this.enTransaccion(async (tx) => {
      const actual = await tx.cita.findUniqueOrThrow({
        where: { id },
        include: { medico: true },
      });
      const p = await op.preparar(actual, tx);
      const { count } = await tx.cita.updateMany({
        where: { id, estado: actual.estado, updatedAt: actual.updatedAt },
        data: p.data,
      });
      if (count === 0) throw new ConflictException(CITA_CAMBIO_CONCURRENTE);
      await this.registrar(tx, {
        citaId: id,
        usuarioId: actor.id,
        accion: op.accion,
        estadoAnterior: actual.estado,
        estadoNuevo: p.estadoNuevo ?? actual.estado,
        cambios: p.cambios,
        comentario: p.comentario ?? null,
      });
      const cita = await tx.cita.findUniqueOrThrow({
        where: { id },
        include: CITA_INCLUDE,
      });
      return { cita, detalle: p.detalle };
    }, mensajeConflicto);

    await this.audit.record({
      action: op.auditoria,
      userId: actor.id,
      detail: `${actor.email} · ${cita.codigo}: ${detalle}`,
      ip,
    });
    return citaPublica(cita);
  }

  /** Carga la cita y verifica que el actor pueda verla (403 auditado). */
  private async cargar(
    actor: AuthUser,
    id: string,
    ip: string | null,
  ): Promise<Cita> {
    const cita = await this.prisma.cita.findUnique({ where: { id } });
    if (!cita) throw new NotFoundException('Cita no encontrada.');
    const permitido =
      actor.role === Role.ADMIN ||
      (actor.role === Role.PACIENTE && cita.pacienteId === actor.id) ||
      (actor.role === Role.CENTRO_MEDICO && cita.centroId === actor.id);
    if (!permitido) {
      throw await this.audit.forbidden(
        actor,
        `la cita ${cita.codigo}`,
        CITA_AJENA,
        ip,
      );
    }
    return cita;
  }

  /** R3 y R4: sin otra cita activa del médico ni del paciente a esa hora. */
  async validarChoques(
    tx: Tx,
    actor: AuthUser,
    args: {
      medico: { id: string; nombre: string };
      pacienteId: string;
      fechaHora: Date;
      excluirId?: string;
    },
  ) {
    const base = {
      fechaHora: args.fechaHora,
      estado: { in: ESTADOS_ACTIVOS },
      ...(args.excluirId ? { id: { not: args.excluirId } } : {}),
    };
    const delMedico = await tx.cita.findFirst({
      where: { ...base, medicoId: args.medico.id },
      select: { codigo: true },
    });
    if (delMedico) {
      throw new ConflictException(
        `${args.medico.nombre} ya tiene una cita el ${formatoRd(args.fechaHora)}. Elige otro horario.`,
      );
    }
    const delPaciente = await tx.cita.findFirst({
      where: { ...base, pacienteId: args.pacienteId },
      select: { codigo: true },
    });
    if (delPaciente) {
      throw new ConflictException(
        actor.role === Role.PACIENTE
          ? `Ya tienes otra cita activa el ${formatoRd(args.fechaHora)} (${delPaciente.codigo}).`
          : `El paciente ya tiene otra cita activa el ${formatoRd(args.fechaHora)} (${delPaciente.codigo}).`,
      );
    }
  }

  private registrar(
    tx: Tx,
    entry: {
      citaId: string;
      usuarioId: string;
      accion: AccionCita;
      estadoAnterior?: EstadoCita | null;
      estadoNuevo?: EstadoCita | null;
      cambios?: Cambios;
      comentario?: string | null;
    },
  ) {
    return tx.citaHistorial.create({
      data: {
        citaId: entry.citaId,
        usuarioId: entry.usuarioId,
        accion: entry.accion,
        estadoAnterior: entry.estadoAnterior ?? null,
        estadoNuevo: entry.estadoNuevo ?? null,
        cambios: (entry.cambios as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        comentario: entry.comentario?.slice(0, 1000) ?? null,
      },
    });
  }

  /**
   * R10: transacción serializable. Si dos reservas compiten por el mismo
   * horario, el índice único parcial (P2002) o el conflicto de
   * serialización (P2034) hacen que una de ellas responda 409.
   */
  private async enTransaccion<T>(
    fn: (tx: Tx) => Promise<T>,
    mensajeConflicto: string,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(HORARIO_TOMADO);
        }
        if (error.code === 'P2034') {
          throw new ConflictException(mensajeConflicto);
        }
      }
      if (
        error instanceof Error &&
        /could not serialize|write conflict|deadlock/i.test(error.message)
      ) {
        throw new ConflictException(mensajeConflicto);
      }
      throw error;
    }
  }
}
