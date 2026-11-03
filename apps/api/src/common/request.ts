import { Request } from 'express';

/** IP del cliente (respeta X-Forwarded-For solo desde el proxy de confianza). */
export function clientIp(req: Request): string | null {
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

/** "GET /api/users" — se usa en el detalle de los accesos denegados. */
export function describeRequest(req: Request): string {
  return `${req.method} ${req.originalUrl.split('?')[0]}`;
}
