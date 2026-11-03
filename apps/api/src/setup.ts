import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * Configuración común de la app (la usan main.ts y las pruebas e2e),
 * para que las pruebas ejerciten exactamente la misma tubería HTTP.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const expressApp = app as NestExpressApplication;

  // Detrás del proxy de Next.js: confiar en X-Forwarded-For solo desde loopback
  expressApp.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string>('WEB_URL', 'http://localhost:3000'),
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
