import { Role } from '@prisma/client';
import { Request } from 'express';

export const AUTH_COOKIE = 'medicita_token';

/** Contenido del JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
}

/** Usuario autenticado que los guards adjuntan a la petición. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

export type AuthRequest = Request & { user?: AuthUser };
