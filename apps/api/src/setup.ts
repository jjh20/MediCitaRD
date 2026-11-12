import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * Orígenes permitidos por CORS. WEB_URL acepta varios separados por coma
 * (por ejemplo, la URL de producción y la de vista previa de Vercel).
 */
export function origenesCors(webUrl: string | undefined): string[] {
  return (webUrl ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Valor de "trust proxy" de Express. En local la API está detrás del proxy
 * de Next en la misma máquina ("loopback"). En Render hay proxies delante
 * (Vercel y el balanceador de Render): TRUST_PROXY=true para que la
 * auditoría registre la IP real del cliente.
 */
export function trustProxy(
  valor: string | undefined,
): boolean | number | string {
  if (!valor) return 'loopback';
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  if (/^\d+$/.test(valor)) return Number(valor);
  return valor;
}

/**
 * Configuración común de la app (la usan main.ts y las pruebas e2e),
 * para que las pruebas ejerciten exactamente la misma tubería HTTP.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const expressApp = app as NestExpressApplication;

  expressApp.set('trust proxy', trustProxy(config.get<string>('TRUST_PROXY')));
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: origenesCors(config.get<string>('WEB_URL')),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
