import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { AuditAction } from '../../audit/audit-actions';
import { AuditService } from '../../audit/audit.service';
import { clientIp, describeRequest } from '../../common/request';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import { AUTH_COOKIE, AuthRequest } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators';

export const UNAUTHENTICATED = 'Debes iniciar sesión para continuar.';

/**
 * Guard global: exige una cookie de sesión con un JWT válido, salvo en rutas @Public().
 * Además compara el token con la base de datos, de modo que desactivar a un
 * usuario o cambiarle el rol invalida su sesión de inmediato.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<AuthRequest>();
    const res = http.getResponse<Response>();
    const token = (req.cookies as Record<string, string> | undefined)?.[
      AUTH_COOKIE
    ];
    if (!token) return this.deny(req, 'sin sesión');

    const payload = await this.auth.tryVerify(token);
    if (!payload) return this.deny(req, 'token inválido o expirado', res);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) return this.deny(req, 'usuario inexistente', res);
    if (!user.isActive) {
      return this.deny(req, 'cuenta desactivada', res, user.id);
    }
    if (user.role !== payload.role) {
      return this.deny(
        req,
        'el rol cambió; debe iniciar sesión de nuevo',
        res,
        user.id,
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
    return true;
  }

  private async deny(
    req: AuthRequest,
    reason: string,
    res?: Response,
    userId?: string,
  ): Promise<never> {
    // Si había un token que ya no sirve, se borra para no reenviarlo.
    res?.clearCookie(AUTH_COOKIE, this.auth.cookieOptions());
    await this.audit.record({
      action: AuditAction.ACCESS_DENIED_401,
      userId,
      detail: `${describeRequest(req)} — ${reason}`,
      ip: clientIp(req),
    });
    throw new UnauthorizedException(UNAUTHENTICATED);
  }
}
