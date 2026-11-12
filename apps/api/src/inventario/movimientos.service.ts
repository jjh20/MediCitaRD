import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Cita,
  EstadoEquipo,
  Prisma,
  Role,
  TipoMovimiento,
  TipoRecurso,
} from '@prisma/client';
import { AuditAction } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { finDiaRd, inicioDiaRd } from '../common/rd-time';
import { PrismaService } from '../prisma/prisma.service';
import {
  AjusteDto,
  AsignacionDto,
  ConsumoDto,
  DevolucionDto,
  EntradaDto,
  ListMovimientosQueryDto,
  SalidaDto,
} from './dto/inventario.dto';
import {
  fefo,
  hoyRd,
  validarAjuste,
  validarAsignacion,
  validarCambioEstadoEquipo,
  validarCantidad,
  validarCitaConsumo,
  validarDevolucion,
  validarEsInsumo,
  validarLoteEntrada,
  validarOperable,
  validarStockSuficiente,
  ymd,
} from './inventario-rules';
import {
  RECURSO_INCLUDE,
  RecursoCompleto,
  RecursosService,
} from './recursos.service';

type Tx = Prisma.TransactionClient;

export const CITA_OTRO_CENTRO =
  'Acceso denegado: la cita pertenece a otro centro.';

export const MOV_INCLUDE = {
  recurso: {
    select: { id: true, codigo: true, nombre: true, tipo: true, unidad: true },
  },
  usuario: { select: { id: true, fullName: true, email: true, role: true } },
  lote: { select: { id: true, numeroLote: true, fechaVencimiento: true } },
  medico: { select: { id: true, nombre: true, especialidad: true } },
  cita: { select: { id: true, codigo: true, fechaHora: true } },
  centro: { select: { id: true, fullName: true } },
} satisfies Prisma.MovimientoInclude;

type MovCompleto = Prisma.MovimientoGetPayload<{ include: typeof MOV_INCLUDE }>;

/** Respuesta pública de un movimiento. */
export function movimientoPublico(m: MovCompleto) {
  return {
    ...m,
    costoUnitario: m.costoUnitario === null ? null : Number(m.costoUnitario),
    lote: m.lote
      ? { ...m.lote, fechaVencimiento: ymd(m.lote.fechaVencimiento) }
      : null,
  };
}

const AUDITORIA: Record<TipoMovimiento, AuditAction> = {
  ENTRADA: AuditAction.MOV_ENTRADA,
  SALIDA: AuditAction.MOV_SALIDA,
  AJUSTE: AuditAction.MOV_AJUSTE,
  ASIGNACION: AuditAction.MOV_ASIGNACION,
  DEVOLUCION: AuditAction.MOV_DEVOLUCION,
};

type DatosMovimiento = Omit<
  Prisma.MovimientoUncheckedCreateInput,
  'recursoId' | 'centroId' | 'usuarioId'
>;

@Injectable()
export class MovimientosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly recursos: RecursosService,
  ) {}

  /** Reloj inyectable para las pruebas. */
  now(): Date {
    return new Date();
  }

  // ─── Operaciones ───────────────────────────────────────────────────

  async entrada(actor: AuthUser, dto: EntradaDto, ip: string | null) {
    await this.recursos.cargar(actor, dto.recursoId, ip);
    const movs = await this.conBloqueo([dto.recursoId], async (tx, [r]) => {
      validarEsInsumo(r, 'La entrada');
      validarOperable(r); // L6
      validarCantidad(dto.cantidad); // L1
      const lote = validarLoteEntrada(
        r,
        dto.numeroLote,
        dto.fechaVencimiento,
        hoyRd(this.now()),
      ); // L3
      let loteId: string | null = null;
      if (lote) {
        const existente = r.lotes.find((l) => l.numeroLote === lote.numeroLote);
        if (existente) {
          if (ymd(existente.fechaVencimiento) !== lote.fechaVencimiento) {
            throw new BadRequestException(
              `El lote ${lote.numeroLote} ya existe con vencimiento ${ymd(existente.fechaVencimiento)}.`,
            );
          }
          await tx.lote.update({
            where: { id: existente.id },
            data: { cantidadDisponible: { increment: dto.cantidad } },
          });
          loteId = existente.id;
        } else {
          const nuevo = await tx.lote.create({
            data: {
              recursoId: r.id,
              numeroLote: lote.numeroLote,
              fechaVencimiento: new Date(`${lote.fechaVencimiento}T00:00:00Z`),
              cantidadDisponible: dto.cantidad,
            },
          });
          loteId = nuevo.id;
        }
      }
      const anterior = r.stockActual ?? 0;
      const costo = dto.costoUnitario ?? Number(r.costoUnitario);
      await tx.recurso.update({
        where: { id: r.id },
        data: {
          stockActual: anterior + dto.cantidad,
          ...(dto.costoUnitario !== undefined ? { costoUnitario: costo } : {}),
        },
      });
      return [
        await this.crear(tx, actor, r, {
          tipo: TipoMovimiento.ENTRADA,
          cantidad: dto.cantidad,
          stockAnterior: anterior,
          stockNuevo: anterior + dto.cantidad,
          loteId,
          motivo: dto.motivo || 'Entrada de inventario',
          referencia: dto.referencia ?? null,
          costoUnitario: costo,
        }),
      ];
    });
    return this.auditar(actor, movs, ip);
  }

  async salida(actor: AuthUser, dto: SalidaDto, ip: string | null) {
    await this.recursos.cargar(actor, dto.recursoId, ip);
    const cita = dto.citaId
      ? await this.cargarCita(actor, dto.citaId, ip)
      : null;
    const movs = await this.conBloqueo([dto.recursoId], (tx, [r]) =>
      this.aplicarSalida(
        tx,
        actor,
        r,
        dto.cantidad,
        dto.motivo ||
          (cita ? `Consumo en la cita ${cita.codigo}` : 'Salida de inventario'),
        cita,
      ),
    );
    return this.auditar(actor, movs, ip);
  }

  /** Consumo de varios insumos en una cita ATENDIDA: todo o nada (L8). */
  async consumo(actor: AuthUser, dto: ConsumoDto, ip: string | null) {
    const cita = await this.cargarCita(actor, dto.citaId, ip);
    const cantidades = new Map<string, number>();
    for (const item of dto.items) {
      cantidades.set(
        item.recursoId,
        (cantidades.get(item.recursoId) ?? 0) + item.cantidad,
      );
    }
    const ids = [...cantidades.keys()];
    for (const id of ids) await this.recursos.cargar(actor, id, ip);
    const movs = await this.conBloqueo(ids, async (tx, recursos) => {
      const todos: MovCompleto[] = [];
      for (const r of recursos) {
        todos.push(
          ...(await this.aplicarSalida(
            tx,
            actor,
            r,
            cantidades.get(r.id)!,
            `Consumo en la cita ${cita.codigo}`,
            cita,
          )),
        );
      }
      return todos;
    });
    return this.auditar(actor, movs, ip);
  }

  async ajuste(actor: AuthUser, dto: AjusteDto, ip: string | null) {
    await this.recursos.cargar(actor, dto.recursoId, ip);
    const movs = await this.conBloqueo([dto.recursoId], async (tx, [r]) => {
      validarOperable(r); // L6
      if (r.tipo === TipoRecurso.EQUIPO) {
        if (!dto.estadoEquipo) {
          throw new BadRequestException(
            'Indica el nuevo estado del equipo (DISPONIBLE o MANTENIMIENTO).',
          );
        }
        const motivo = dto.motivo?.trim();
        if (!motivo)
          throw new BadRequestException('El ajuste exige un motivo.');
        validarCambioEstadoEquipo(r, dto.estadoEquipo);
        await tx.recurso.update({
          where: { id: r.id },
          data: { estadoEquipo: dto.estadoEquipo },
        });
        return [
          await this.crear(tx, actor, r, {
            tipo: TipoMovimiento.AJUSTE,
            cantidad: 1,
            estadoEquipoAnterior: r.estadoEquipo,
            estadoEquipoNuevo: dto.estadoEquipo,
            motivo,
          }),
        ];
      }
      if (!dto.sentido || dto.cantidad === undefined) {
        throw new BadRequestException(
          'Indica si el ajuste aumenta o disminuye el stock, y la cantidad.',
        );
      }
      const anterior = r.stockActual ?? 0;
      let loteId: string | null = null;
      let motivo: string;
      if (r.requiereVencimiento) {
        if (!dto.loteId) {
          throw new BadRequestException('Indica el lote que vas a ajustar.');
        }
        const lote = r.lotes.find((l) => l.id === dto.loteId);
        if (!lote)
          throw new NotFoundException('Lote no encontrado en este recurso.');
        motivo = validarAjuste(
          dto.motivo,
          dto.sentido,
          dto.cantidad,
          lote.cantidadDisponible,
        ); // L7
        await tx.lote.update({
          where: { id: lote.id },
          data: {
            cantidadDisponible:
              dto.sentido === 'AUMENTO'
                ? { increment: dto.cantidad }
                : { decrement: dto.cantidad },
          },
        });
        loteId = lote.id;
      } else {
        motivo = validarAjuste(dto.motivo, dto.sentido, dto.cantidad, anterior); // L7
      }
      const nuevo =
        dto.sentido === 'AUMENTO'
          ? anterior + dto.cantidad
          : anterior - dto.cantidad;
      await tx.recurso.update({
        where: { id: r.id },
        data: { stockActual: nuevo },
      });
      return [
        await this.crear(tx, actor, r, {
          tipo: TipoMovimiento.AJUSTE,
          cantidad: dto.cantidad,
          stockAnterior: anterior,
          stockNuevo: nuevo,
          loteId,
          motivo,
        }),
      ];
    });
    return this.auditar(actor, movs, ip);
  }

  async asignacion(actor: AuthUser, dto: AsignacionDto, ip: string | null) {
    await this.recursos.cargar(actor, dto.recursoId, ip);
    const medico = await this.prisma.medico.findUnique({
      where: { id: dto.medicoId },
    });
    if (!medico) throw new NotFoundException('Médico no encontrado.');
    const fecha = new Date(dto.fechaDevolucionPrevista);
    const movs = await this.conBloqueo([dto.recursoId], async (tx, [r]) => {
      validarOperable(r); // L6
      validarAsignacion(r, medico, fecha, this.now()); // L4
      await tx.recurso.update({
        where: { id: r.id },
        data: {
          estadoEquipo: EstadoEquipo.ASIGNADO,
          medicoAsignadoId: medico.id,
          devolucionPrevista: fecha,
        },
      });
      return [
        await this.crear(tx, actor, r, {
          tipo: TipoMovimiento.ASIGNACION,
          cantidad: 1,
          estadoEquipoAnterior: r.estadoEquipo,
          estadoEquipoNuevo: EstadoEquipo.ASIGNADO,
          medicoId: medico.id,
          fechaDevolucionPrevista: fecha,
          motivo: dto.motivo || `Asignado a ${medico.nombre}`,
        }),
      ];
    });
    return this.auditar(actor, movs, ip);
  }

  async devolucion(actor: AuthUser, dto: DevolucionDto, ip: string | null) {
    await this.recursos.cargar(actor, dto.recursoId, ip);
    const movs = await this.conBloqueo([dto.recursoId], async (tx, [r]) => {
      validarOperable(r); // L6
      validarDevolucion(r); // L5
      await tx.recurso.update({
        where: { id: r.id },
        data: {
          estadoEquipo: EstadoEquipo.DISPONIBLE,
          medicoAsignadoId: null,
          devolucionPrevista: null,
        },
      });
      return [
        await this.crear(tx, actor, r, {
          tipo: TipoMovimiento.DEVOLUCION,
          cantidad: 1,
          estadoEquipoAnterior: EstadoEquipo.ASIGNADO,
          estadoEquipoNuevo: EstadoEquipo.DISPONIBLE,
          medicoId: r.medicoAsignadoId,
          motivo:
            dto.motivo ||
            `Devuelto por ${r.medicoAsignado?.nombre ?? 'el médico asignado'}`,
        }),
      ];
    });
    return this.auditar(actor, movs, ip);
  }

  // ─── Consultas ─────────────────────────────────────────────────────

  async list(actor: AuthUser, query: ListMovimientosQueryDto) {
    const where: Prisma.MovimientoWhereInput = {};
    if (actor.role === Role.CENTRO_MEDICO) where.centroId = actor.id;
    else if (query.centroId) where.centroId = query.centroId;
    if (query.tipo) where.tipo = query.tipo;
    if (query.recursoId) where.recursoId = query.recursoId;
    if (query.medicoId) where.medicoId = query.medicoId;
    if (query.citaId) where.citaId = query.citaId;
    if (query.desde || query.hasta) {
      where.createdAt = {
        gte: query.desde ? inicioDiaRd(query.desde) : undefined,
        lte: query.hasta ? finDiaRd(query.hasta) : undefined,
      };
    }
    const and: Prisma.MovimientoWhereInput[] = [];
    if (query.usuario) {
      const u = { contains: query.usuario, mode: 'insensitive' as const };
      and.push({
        OR: [{ usuario: { email: u } }, { usuario: { fullName: u } }],
      });
    }
    if (query.texto) {
      const t = { contains: query.texto, mode: 'insensitive' as const };
      and.push({
        OR: [
          { codigo: t },
          { recurso: { nombre: t } },
          { recurso: { codigo: t } },
        ],
      });
    }
    if (and.length) where.AND = and;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.movimiento.findMany({
        where,
        include: MOV_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { codigo: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.movimiento.count({ where }),
    ]);
    return {
      items: items.map(movimientoPublico),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Historial de un recurso, del más antiguo al más reciente. */
  async historial(actor: AuthUser, recursoId: string, ip: string | null) {
    await this.recursos.cargar(actor, recursoId, ip);
    const items = await this.prisma.movimiento.findMany({
      where: { recursoId },
      include: MOV_INCLUDE,
      orderBy: [{ createdAt: 'asc' }, { codigo: 'asc' }],
    });
    return items.map(movimientoPublico);
  }

  // ─── Internos ──────────────────────────────────────────────────────

  /**
   * L9: abre una transacción y bloquea las filas de los recursos
   * (SELECT … FOR UPDATE, en orden de id para evitar interbloqueos). Una
   * segunda operación sobre el mismo recurso espera y luego lee el stock ya
   * actualizado, así que nunca deja el stock negativo.
   */
  private conBloqueo<T>(
    ids: string[],
    fn: (tx: Tx, recursos: RecursoCompleto[]) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        for (const id of [...ids].sort()) {
          await tx.$queryRaw`SELECT id FROM "Recurso" WHERE id = ${id} FOR UPDATE`;
        }
        const recursos = await tx.recurso.findMany({
          where: { id: { in: ids } },
          include: RECURSO_INCLUDE,
        });
        const porId = new Map(recursos.map((r) => [r.id, r]));
        return fn(
          tx,
          ids.map((id) => porId.get(id)!),
        );
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
  }

  /** Salida de un insumo: FEFO por lotes (L3) o stock simple (L2). */
  private async aplicarSalida(
    tx: Tx,
    actor: AuthUser,
    r: RecursoCompleto,
    cantidad: number,
    motivo: string,
    cita: Cita | null,
  ): Promise<MovCompleto[]> {
    validarEsInsumo(r, 'La salida');
    validarOperable(r); // L6
    validarCantidad(cantidad); // L1
    let stock = r.stockActual ?? 0;
    const movs: MovCompleto[] = [];
    const base = {
      tipo: TipoMovimiento.SALIDA,
      motivo,
      citaId: cita?.id ?? null,
    };
    if (r.requiereVencimiento) {
      for (const parte of fefo(r.lotes, cantidad, hoyRd(this.now()))) {
        await tx.lote.update({
          where: { id: parte.lote.id },
          data: { cantidadDisponible: { decrement: parte.cantidad } },
        });
        parte.lote.cantidadDisponible -= parte.cantidad;
        movs.push(
          await this.crear(tx, actor, r, {
            ...base,
            cantidad: parte.cantidad,
            stockAnterior: stock,
            stockNuevo: stock - parte.cantidad,
            loteId: parte.lote.id,
          }),
        );
        stock -= parte.cantidad;
      }
    } else {
      validarStockSuficiente(stock, cantidad); // L2
      movs.push(
        await this.crear(tx, actor, r, {
          ...base,
          cantidad,
          stockAnterior: stock,
          stockNuevo: stock - cantidad,
        }),
      );
      stock -= cantidad;
    }
    await tx.recurso.update({
      where: { id: r.id },
      data: { stockActual: stock },
    });
    r.stockActual = stock;
    return movs;
  }

  private crear(
    tx: Tx,
    actor: AuthUser,
    r: RecursoCompleto,
    data: DatosMovimiento,
  ) {
    return tx.movimiento.create({
      data: {
        recursoId: r.id,
        centroId: r.centroId,
        usuarioId: actor.id,
        costoUnitario: r.costoUnitario,
        ...data,
      },
      include: MOV_INCLUDE,
    });
  }

  /** L8: la cita debe ser del mismo centro (403 auditado) y estar ATENDIDA. */
  private async cargarCita(actor: AuthUser, citaId: string, ip: string | null) {
    const cita = await this.prisma.cita.findUnique({ where: { id: citaId } });
    if (!cita) throw new NotFoundException('Cita no encontrada.');
    if (cita.centroId !== actor.id) {
      throw await this.audit.forbidden(
        actor,
        `la cita ${cita.codigo}`,
        CITA_OTRO_CENTRO,
        ip,
      );
    }
    validarCitaConsumo(cita);
    return cita;
  }

  private async auditar(
    actor: AuthUser,
    movs: MovCompleto[],
    ip: string | null,
  ) {
    const m = movs[0];
    const recursos = [
      ...new Set(movs.map((x) => `${x.recurso.codigo} ${x.recurso.nombre}`)),
    ];
    const detalle =
      m.tipo === TipoMovimiento.ASIGNACION ||
      m.tipo === TipoMovimiento.DEVOLUCION ||
      (m.estadoEquipoNuevo && m.tipo === TipoMovimiento.AJUSTE)
        ? `${recursos[0]}: ${m.estadoEquipoAnterior ?? ''} → ${m.estadoEquipoNuevo ?? ''}${m.medico ? ` (${m.medico.nombre})` : ''}`
        : `${movs.reduce((s, x) => s + x.cantidad, 0)} u. de ${recursos.join(', ')}${m.cita ? ` en ${m.cita.codigo}` : ''}`;
    await this.audit.record({
      action: AUDITORIA[m.tipo],
      userId: actor.id,
      detail: `${actor.email} · ${movs.map((x) => x.codigo).join(', ')} ${m.tipo}: ${detalle}`,
      ip,
    });
    return movs.map(movimientoPublico);
  }
}
