import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AuditAction } from '../../audit/audit-actions';
import { AuditService } from '../../audit/audit.service';
import { clientIp, describeRequest } from '../../common/request';
import { AuthRequest } from '../auth.types';
import { ROLES_KEY } from '../decorators';

export const FORBIDDEN =
  'Acceso denegado: tu perfil no tiene permiso para este recurso.';

/** Guard global: aplica @Roles(); se ejecuta después de JwtAuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (req.user && roles.includes(req.user.role)) return true;

    await this.audit.record({
      action: AuditAction.ACCESS_DENIED_403,
      userId: req.user?.id,
      detail: `${describeRequest(req)} — rol ${req.user?.role ?? 'ninguno'} (requiere ${roles.join(' o ')})`,
      ip: clientIp(req),
    });
    throw new ForbiddenException(FORBIDDEN);
  }
}
