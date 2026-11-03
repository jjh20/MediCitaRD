import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup';

export const STRONG_PASSWORD = 'Prueba-Segura-2026!';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

/** Levanta la app con la misma configuración que main.ts. */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog", "User" RESTART IDENTITY CASCADE',
  );
}

/** Crea un usuario directamente en la base (para preparar escenarios). */
export async function createUser(
  prisma: PrismaService,
  data: { email: string; role: Role; isActive?: boolean; fullName?: string },
): Promise<User> {
  return prisma.user.create({
    data: {
      email: data.email,
      fullName: data.fullName ?? data.email.split('@')[0],
      role: data.role,
      isActive: data.isActive ?? true,
      // costo bajo solo para acelerar las pruebas
      passwordHash: await bcrypt.hash(STRONG_PASSWORD, 4),
    },
  });
}

/** Agente con cookies (como un navegador) ya autenticado. */
export async function loginAs(
  app: INestApplication,
  email: string,
  password = STRONG_PASSWORD,
): Promise<TestAgent> {
  const agent = request.agent(app.getHttpServer());
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return agent;
}

export function setCookieHeader(res: request.Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return (header ?? []).join('; ');
}

export async function auditActions(prisma: PrismaService) {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'asc' },
  });
  return logs.map((log) => log.action);
}
