import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthRequest, AuthUser } from './auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marca una ruta como pública: JwtAuthGuard no exige sesión. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restringe una ruta (o controlador) a los roles indicados. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Inyecta el usuario autenticado en un parámetro del handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<AuthRequest>().user,
);
