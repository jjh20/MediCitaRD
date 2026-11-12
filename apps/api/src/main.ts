import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const config = app.get(ConfigService);
  // En Render (y otras plataformas) el puerto llega en PORT; en local, API_PORT
  const port = Number(
    config.get<string>('PORT') ?? config.get<string>('API_PORT') ?? 4000,
  );
  await app.listen(port);
  Logger.log(
    `API de MediCita RD escuchando en el puerto ${port} (prefijo /api)`,
    'Bootstrap',
  );
}
void bootstrap();
