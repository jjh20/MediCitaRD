import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoEquipo,
  Prisma,
  Role,
  TipoMovimiento,
  TipoRecurso,
} from '@prisma/client';
import { AuditAction } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRecursoDto,
  ListRecursosQueryDto,
  UpdateRecursoDto,
} from './dto/inventario.dto';
import {
  alertas,
  ESTADO_EQUIPO_LABELS,
  estadoLote,
  hoyRd,
  lotesUtilizables,
  stockDisponible,
  ymd,
} from './inventario-rules';

export const RECURSO_AJENO =
  'Acceso denegado: este recurso pertenece a otro centro.';

export const RECURSO_INCLUDE = {
  centro: { select: { id: true, fullName: true } },
  medicoAsignado: { select: { id: true, nombre: true, especialidad: true } },
  lotes: { orderBy: [{ fechaVencimiento: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.RecursoInclude;

export type RecursoCompleto = Prisma.RecursoGetPayload<{
  include: typeof RECURSO_INCLUDE;
}>;

/** Respuesta pública de un recurso: números, disponible, valor y alertas (L10). */
export function recursoPublico(r: RecursoCompleto, hoy = hoyRd()) {
  const costo = Number(r.costoUnitario);
  const disponible = stockDisponible(r, r.lotes, hoy);
  const vencidas = r.requiereVencimiento
    ? r.lotes
        .filter((l) => estadoLote(l.fechaVencimiento, hoy) === 'VENCIDO')
        .reduce((s, l) => s + l.cantidadDisponible, 0)
    : 0;
  const valor =
    r.tipo === TipoRecurso.INSUMO
      ? (r.stockActual ?? 0) * costo
      : r.estadoEquipo === EstadoEquipo.BAJA
        ? 0
        : costo;
  const { lotes, ...resto } = r;
  return {
    ...resto,
    costoUnitario: costo,
    disponible,
    unidadesVencidas: vencidas,
    valor: Math.round(valor * 100) / 100,
    alertas: alertas(r, lotes, hoy),
    lotes: lotes
      .filter((l) => l.cantidadDisponible > 0)
      .map((l) => ({
        id: l.id,
        numeroLote: l.numeroLote,
        fechaVencimiento: ymd(l.fechaVencimiento),
        cantidadDisponible: l.cantidadDisponible,
        estado: estadoLote(l.fechaVencimiento, hoy),
      })),
  };
}

@Injectable()
export class RecursosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Lista con filtros. Los filtros de estado calculados (bajo stock, próximo
   * a vencer, vencido) se aplican en memoria: el inventario de un centro es
   * pequeño y así las alertas usan exactamente las mismas reglas (L10).
   */
  async list(actor: AuthUser, query: ListRecursosQueryDto) {
    const where: Prisma.RecursoWhereInput = {};
    if (actor.role === Role.CENTRO_MEDICO) where.centroId = actor.id;
    else if (query.centroId) where.centroId = query.centroId;
    if (query.tipo) where.tipo = query.tipo;
    if (query.categoria) where.categoria = query.categoria;
    if (query.texto) {
      const t = { contains: query.texto, mode: 'insensitive' as const };
      where.OR = [{ nombre: t }, { codigo: t }, { numeroSerie: t }];
    }
    switch (query.estado) {
      case 'disponible':
        where.estadoEquipo = EstadoEquipo.DISPONIBLE;
        break;
      case 'asignado':
        where.estadoEquipo = EstadoEquipo.ASIGNADO;
        break;
      case 'mantenimiento':
        where.estadoEquipo = EstadoEquipo.MANTENIMIENTO;
        break;
      case 'inactivo':
        where.activo = false;
        break;
    }
    const hoy = hoyRd();
    const todos = (
      await this.prisma.recurso.findMany({
        where,
        include: RECURSO_INCLUDE,
        orderBy: [{ activo: 'desc' }, { tipo: 'desc' }, { nombre: 'asc' }],
      })
    ).map((r) => recursoPublico(r, hoy));

    const filtrados = todos.filter((r) => {
      if (query.estado === 'bajo_stock') return r.alertas.bajoStock;
      if (query.estado === 'proximo_vencer') return r.alertas.proximoAVencer;
      if (query.estado === 'vencido') return r.alertas.vencido;
      return true;
    });
    const inicio = (query.page - 1) * query.pageSize;
    return {
      items: filtrados.slice(inicio, inicio + query.pageSize),
      total: filtrados.length,
      page: query.page,
      pageSize: query.pageSize,
      resumen: {
        bajoStock: todos.filter((r) => r.alertas.bajoStock).length,
        proximoAVencer: todos.filter((r) => r.alertas.proximoAVencer).length,
        vencido: todos.filter((r) => r.alertas.vencido).length,
      },
    };
  }

  async get(actor: AuthUser, id: string, ip: string | null) {
    return recursoPublico(await this.cargar(actor, id, ip));
  }

  async create(actor: AuthUser, dto: CreateRecursoDto, ip: string | null) {
    const esInsumo = dto.tipo === TipoRecurso.INSUMO;
    let recurso: RecursoCompleto;
    try {
      recurso = await this.prisma.recurso.create({
        data: {
          centroId: actor.id,
          nombre: dto.nombre,
          tipo: dto.tipo,
          categoria: dto.categoria,
          unidad: dto.unidad,
          costoUnitario: dto.costoUnitario,
          stockActual: esInsumo ? 0 : null,
          stockMinimo: esInsumo ? (dto.stockMinimo ?? 0) : null,
          requiereVencimiento: esInsumo
            ? (dto.requiereVencimiento ?? false)
            : false,
          estadoEquipo: esInsumo ? null : EstadoEquipo.DISPONIBLE,
          numeroSerie: esInsumo ? null : (dto.numeroSerie ?? null),
        },
        include: RECURSO_INCLUDE,
      });
    } catch (error) {
      throw this.nombreDuplicado(error);
    }
    await this.audit.record({
      action: AuditAction.RECURSO_CREADO,
      userId: actor.id,
      detail: `${actor.email} registró ${recurso.codigo} ${recurso.nombre} (${recurso.tipo})`,
      ip,
    });
    return recursoPublico(recurso);
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateRecursoDto,
    ip: string | null,
  ) {
    const actual = await this.cargar(actor, id, ip);
    const esInsumo = actual.tipo === TipoRecurso.INSUMO;
    if (
      dto.requiereVencimiento !== undefined &&
      dto.requiereVencimiento !== actual.requiereVencimiento &&
      (actual.stockActual ?? 0) > 0
    ) {
      throw new BadRequestException(
        'No se puede cambiar si requiere vencimiento mientras el insumo tenga existencias.',
      );
    }
    const data: Prisma.RecursoUpdateInput = {
      nombre: dto.nombre,
      categoria: dto.categoria,
      unidad: dto.unidad,
      costoUnitario: dto.costoUnitario,
      ...(esInsumo
        ? {
            stockMinimo: dto.stockMinimo,
            requiereVencimiento: dto.requiereVencimiento,
          }
        : { numeroSerie: dto.numeroSerie }),
    };
    let recurso: RecursoCompleto;
    try {
      recurso = await this.prisma.recurso.update({
        where: { id },
        data,
        include: RECURSO_INCLUDE,
      });
    } catch (error) {
      throw this.nombreDuplicado(error);
    }
    await this.audit.record({
      action: AuditAction.RECURSO_ACTUALIZADO,
      userId: actor.id,
      detail: `${actor.email} actualizó ${recurso.codigo} ${recurso.nombre}: ${Object.keys(dto).join(', ') || 'sin cambios'}`,
      ip,
    });
    return recursoPublico(recurso);
  }

  /**
   * Activar o dar de baja. En los equipos el cambio de estado queda como un
   * movimiento AJUSTE (con el estado antes y después), en la misma transacción.
   */
  async setActivo(
    actor: AuthUser,
    id: string,
    activo: boolean,
    motivo: string | undefined,
    ip: string | null,
  ) {
    const previo = await this.cargar(actor, id, ip);
    const recurso = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Recurso" WHERE id = ${id} FOR UPDATE`;
      const r = await tx.recurso.findUniqueOrThrow({ where: { id } });
      if (r.activo === activo) {
        throw new BadRequestException(
          activo
            ? 'El recurso ya está activo.'
            : 'El recurso ya está dado de baja.',
        );
      }
      if (!activo && r.estadoEquipo === EstadoEquipo.ASIGNADO) {
        throw new ConflictException(
          `${r.nombre} está asignado: registra la devolución antes de darlo de baja.`,
        );
      }
      if (r.tipo === TipoRecurso.EQUIPO) {
        const nuevo = activo ? EstadoEquipo.DISPONIBLE : EstadoEquipo.BAJA;
        await tx.movimiento.create({
          data: {
            recursoId: r.id,
            centroId: r.centroId,
            usuarioId: actor.id,
            tipo: TipoMovimiento.AJUSTE,
            cantidad: 1,
            estadoEquipoAnterior: r.estadoEquipo,
            estadoEquipoNuevo: nuevo,
            motivo:
              motivo?.trim() ||
              (activo ? 'Equipo reactivado' : 'Equipo dado de baja'),
            costoUnitario: r.costoUnitario,
          },
        });
        return tx.recurso.update({
          where: { id },
          data: { activo, estadoEquipo: nuevo },
          include: RECURSO_INCLUDE,
        });
      }
      return tx.recurso.update({
        where: { id },
        data: { activo },
        include: RECURSO_INCLUDE,
      });
    });
    await this.audit.record({
      action: activo ? AuditAction.RECURSO_ACTIVADO : AuditAction.RECURSO_BAJA,
      userId: actor.id,
      detail: `${actor.email} ${activo ? 'activó' : 'dio de baja'} ${previo.codigo} ${previo.nombre}`,
      ip,
    });
    return recursoPublico(recurso);
  }

  /** Stock disponible por lote (sin vencidos) o estado y asignación del equipo. */
  async disponibilidad(actor: AuthUser, id: string, ip: string | null) {
    const r = await this.cargar(actor, id, ip);
    const hoy = hoyRd();
    if (r.tipo === TipoRecurso.EQUIPO) {
      return {
        recursoId: r.id,
        codigo: r.codigo,
        tipo: r.tipo,
        estadoEquipo: r.estadoEquipo,
        estadoTexto: ESTADO_EQUIPO_LABELS[r.estadoEquipo ?? 'DISPONIBLE'],
        disponible: r.activo && r.estadoEquipo === EstadoEquipo.DISPONIBLE,
        medicoAsignado: r.medicoAsignado,
        devolucionPrevista: r.devolucionPrevista,
        devolucionAtrasada:
          r.estadoEquipo === EstadoEquipo.ASIGNADO &&
          !!r.devolucionPrevista &&
          r.devolucionPrevista.getTime() < Date.now(),
      };
    }
    const utilizables = new Set(
      lotesUtilizables(r.lotes, hoy).map((l) => l.id),
    );
    return {
      recursoId: r.id,
      codigo: r.codigo,
      tipo: r.tipo,
      unidad: r.unidad,
      activo: r.activo,
      stockActual: r.stockActual,
      stockMinimo: r.stockMinimo,
      disponible: stockDisponible(r, r.lotes, hoy),
      requiereVencimiento: r.requiereVencimiento,
      alertas: alertas(r, r.lotes, hoy),
      lotes: r.lotes
        .filter((l) => l.cantidadDisponible > 0)
        .map((l) => ({
          id: l.id,
          numeroLote: l.numeroLote,
          fechaVencimiento: ymd(l.fechaVencimiento),
          cantidadDisponible: l.cantidadDisponible,
          estado: estadoLote(l.fechaVencimiento, hoy),
          utilizable: utilizables.has(l.id),
        })),
    };
  }

  /** Carga un recurso y verifica que el actor pueda verlo (403 auditado). */
  async cargar(
    actor: AuthUser,
    id: string,
    ip: string | null,
  ): Promise<RecursoCompleto> {
    const recurso = await this.prisma.recurso.findUnique({
      where: { id },
      include: RECURSO_INCLUDE,
    });
    if (!recurso) throw new NotFoundException('Recurso no encontrado.');
    // El admin ve todo (solo lectura: las escrituras las limita @Roles)
    if (actor.role === Role.CENTRO_MEDICO && recurso.centroId !== actor.id) {
      throw await this.audit.forbidden(
        actor,
        `el recurso ${recurso.codigo}`,
        RECURSO_AJENO,
        ip,
      );
    }
    return recurso;
  }

  private nombreDuplicado(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'Ya existe un recurso con ese nombre en tu centro.',
      );
    }
    return error;
  }
}
