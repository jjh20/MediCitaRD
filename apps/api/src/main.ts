import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = app.get(ConfigService).get<number>('API_PORT', 4000);
  await app.listen(port);
  Logger.log(`API de MediCita RD en http://localhost:${port}/api`, 'Bootstrap');
}
void bootstrap();
