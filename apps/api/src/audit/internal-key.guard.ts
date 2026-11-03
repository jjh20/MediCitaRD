import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

export const INTERNAL_KEY_HEADER = 'x-internal-key';

/**
 * Solo deja pasar llamadas que traen la clave interna compartida
 * (INTERNAL_API_KEY), es decir, las del middleware de Next.js.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const received = req.header(INTERNAL_KEY_HEADER) ?? '';
    const expected = this.config.getOrThrow<string>('INTERNAL_API_KEY');
    // Se comparan hashes de igual longitud en tiempo constante.
    const digest = (value: string) =>
      createHash('sha256').update(value).digest();
    if (!received || !timingSafeEqual(digest(received), digest(expected))) {
      throw new UnauthorizedException('Llamada interna no autorizada.');
    }
    return true;
  }
}
