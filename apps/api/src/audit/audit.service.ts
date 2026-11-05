import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from './audit-actions';

export interface AuditEntry {
  action: AuditAction;
  userId?: string | null;
  detail?: string;
  ip?: string | null;
}

export interface AuditQuery {
  action?: AuditAction;
  /** Coincidencia parcial con el correo o nombre del usuario, o con el detalle */
  user?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un evento. Nunca lanza: un fallo de auditoría se reporta en el
   * log, pero no debe romper la operación que se está auditando.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          userId: entry.userId ?? null,
          detail: entry.detail?.slice(0, 500),
          ip: entry.ip?.slice(0, 64) ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el evento ${entry.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Registra un 403 por intentar acceder a un recurso de otro usuario
   * (cita o médico ajeno) y devuelve la excepción para lanzarla.
   */
  async forbidden(
    actor: AuthUser,
    recurso: string,
    message: string,
    ip: string | null,
  ): Promise<ForbiddenException> {
    await this.record({
      action: AuditAction.ACCESS_DENIED_403,
      userId: actor.id,
      detail: `${actor.email} (${actor.role}) intentó acceder sin permiso a ${recurso}`,
      ip,
    });
    return new ForbiddenException(message);
  }

  async find(query: AuditQuery) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = query.action;
    if (query.user) {
      // Coincide con quien hizo la acción o con el usuario afectado (en el detalle)
      where.OR = [
        { user: { email: { contains: query.user, mode: 'insensitive' } } },
        { user: { fullName: { contains: query.user, mode: 'insensitive' } } },
        { detail: { contains: query.user, mode: 'insensitive' } },
      ];
    }
    if (query.from || query.to) {
      where.createdAt = { gte: query.from, lte: query.to };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: {
            select: { id: true, email: true, fullName: true, role: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
