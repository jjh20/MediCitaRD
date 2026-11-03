import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { AuditAction } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '../auth/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { ListUsersQueryDto } from './dto/users.dto';

export const LAST_ADMIN_MESSAGE =
  'No se puede quitar el rol ni desactivar al último administrador activo.';

const PUBLIC_FIELDS = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type Tx = Prisma.TransactionClient;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.role) where.role = query.role;
    if (query.status) where.isActive = query.status === 'active';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: PUBLIC_FIELDS,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** Catálogo de roles con sus permisos (se muestra en el panel de admin). */
  rolesCatalog() {
    return Object.values(Role).map((role) => ({
      role,
      label: ROLE_LABELS[role],
      permissions: ROLE_PERMISSIONS[role],
    }));
  }

  async changeRole(
    actor: AuthUser,
    targetId: string,
    role: Role,
    ip: string | null,
  ) {
    if (actor.id === targetId) {
      throw new BadRequestException('No puedes cambiar tu propio rol.');
    }
    const { before, after } = await this.prisma.$transaction(
      async (tx) => {
        const target = await this.findOrFail(tx, targetId);
        if (target.role === role) {
          throw new BadRequestException(
            `El usuario ya tiene el rol ${ROLE_LABELS[role]}.`,
          );
        }
        if (target.role === Role.ADMIN && target.isActive) {
          await this.ensureAnotherActiveAdmin(tx, target.id);
        }
        const updated = await tx.user.update({
          where: { id: target.id },
          data: { role },
          select: PUBLIC_FIELDS,
        });
        return { before: target, after: updated };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.audit.record({
      action: AuditAction.ROLE_CHANGED,
      userId: actor.id,
      detail: `${actor.email} cambió el rol de ${before.email}: ${ROLE_LABELS[before.role]} → ${ROLE_LABELS[after.role]}`,
      ip,
    });
    return after;
  }

  async setActive(
    actor: AuthUser,
    targetId: string,
    isActive: boolean,
    ip: string | null,
  ) {
    if (actor.id === targetId) {
      throw new BadRequestException(
        'No puedes activar ni desactivar tu propia cuenta.',
      );
    }
    const { before, after } = await this.prisma.$transaction(
      async (tx) => {
        const target = await this.findOrFail(tx, targetId);
        if (target.isActive === isActive) {
          throw new BadRequestException(
            isActive
              ? 'El usuario ya está activo.'
              : 'El usuario ya está desactivado.',
          );
        }
        if (!isActive && target.role === Role.ADMIN) {
          await this.ensureAnotherActiveAdmin(tx, target.id);
        }
        const updated = await tx.user.update({
          where: { id: target.id },
          data: { isActive },
          select: PUBLIC_FIELDS,
        });
        return { before: target, after: updated };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.audit.record({
      action: isActive
        ? AuditAction.USER_ACTIVATED
        : AuditAction.USER_DEACTIVATED,
      userId: actor.id,
      detail: `${actor.email} ${isActive ? 'activó' : 'desactivó'} la cuenta de ${before.email}`,
      ip,
    });
    return after;
  }

  private async findOrFail(tx: Tx, id: string): Promise<User> {
    const user = await tx.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return user;
  }

  /**
   * Regla de negocio: siempre debe quedar al menos un administrador activo.
   * (Complementa la regla de no modificarse a sí mismo.)
   */
  private async ensureAnotherActiveAdmin(tx: Tx, excludeId: string) {
    const others = await tx.user.count({
      where: { role: Role.ADMIN, isActive: true, id: { not: excludeId } },
    });
    if (others === 0) throw new ConflictException(LAST_ADMIN_MESSAGE);
  }
}
