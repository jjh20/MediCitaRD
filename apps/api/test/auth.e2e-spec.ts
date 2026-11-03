import { Role } from '@prisma/client';
import request from 'supertest';
import { AuditAction } from '../src/audit/audit-actions';
import {
  auditActions,
  createTestApp,
  createUser,
  loginAs,
  resetDatabase,
  setCookieHeader,
  STRONG_PASSWORD,
  TestContext,
} from './helpers';

describe('Autenticación (e2e)', () => {
  let ctx: TestContext;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('HU-01 Registro', () => {
    it('TC-01 registra un Paciente, inicia sesión y audita REGISTER', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({
          fullName: 'Ana Gómez',
          email: 'Ana@Correo.do',
          password: STRONG_PASSWORD,
          role: 'PACIENTE',
        })
        .expect(201);

      expect(res.body.user).toMatchObject({
        email: 'ana@correo.do',
        role: 'PACIENTE',
        isActive: true,
      });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(setCookieHeader(res)).toContain('medicita_token=');

      const saved = await ctx.prisma.user.findUniqueOrThrow({
        where: { email: 'ana@correo.do' },
      });
      expect(saved.passwordHash).not.toContain(STRONG_PASSWORD);
      expect(saved.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, costo 12
      expect(await auditActions(ctx.prisma)).toEqual([AuditAction.REGISTER]);
    });

    it('TC-02 registra un Centro médico', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({
          fullName: 'Centro Médico Esperanza',
          email: 'contacto@esperanza.do',
          password: STRONG_PASSWORD,
          role: 'CENTRO_MEDICO',
        })
        .expect(201);
      expect(res.body.user.role).toBe('CENTRO_MEDICO');
    });

    it('TC-03 rechaza registrarse como Administrador', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({
          fullName: 'Intruso',
          email: 'intruso@correo.do',
          password: STRONG_PASSWORD,
          role: 'ADMIN',
        })
        .expect(400);
      expect(res.body.message).toContain(
        'Solo puedes registrarte como Paciente o Centro médico.',
      );
      expect(await ctx.prisma.user.count()).toBe(0);
    });

    it.each([
      ['corta', 'Ab1!xyz'],
      ['sin mayúscula', 'minusculas-123!'],
      ['sin minúscula', 'MAYUSCULAS-123!'],
      ['sin número', 'Sin-Numeros-Aqui!'],
      ['sin símbolo', 'SinSimbolo12345'],
    ])('TC-04 rechaza una contraseña débil (%s)', async (_caso, password) => {
      const res = await http()
        .post('/api/auth/register')
        .send({
          fullName: 'Luis Peña',
          email: 'luis@correo.do',
          password,
          role: 'PACIENTE',
        })
        .expect(400);
      expect(res.body.message.join(' ')).toContain('al menos 10 caracteres');
      expect(await ctx.prisma.user.count()).toBe(0);
    });

    it('TC-05 rechaza un correo duplicado (sin importar mayúsculas)', async () => {
      await createUser(ctx.prisma, {
        email: 'repetido@correo.do',
        role: Role.PACIENTE,
      });
      const res = await http()
        .post('/api/auth/register')
        .send({
          fullName: 'Otra Persona',
          email: 'REPETIDO@correo.do',
          password: STRONG_PASSWORD,
          role: 'PACIENTE',
        })
        .expect(409);
      expect(res.body.message).toBe(
        'Ya existe una cuenta registrada con ese correo electrónico.',
      );
    });

    it('TC-06 rechaza datos inválidos y campos no permitidos', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({
          fullName: '',
          email: 'no-es-correo',
          password: STRONG_PASSWORD,
          role: 'PACIENTE',
          isActive: false,
        })
        .expect(400);
      const messages = (res.body.message as string[]).join(' ');
      expect(messages).toContain('correo electrónico válido');
      expect(messages).toContain('nombre');
      expect(messages).toContain('isActive should not exist');
    });
  });

  describe('HU-02 Inicio de sesión', () => {
    beforeEach(async () => {
      await createUser(ctx.prisma, {
        email: 'paciente@correo.do',
        role: Role.PACIENTE,
      });
    });

    it('TC-07 inicia sesión con cookie httpOnly, sameSite=lax y expiración de 8 h', async () => {
      const res = await http()
        .post('/api/auth/login')
        .send({ email: 'paciente@correo.do', password: STRONG_PASSWORD })
        .expect(200);

      const cookie = setCookieHeader(res);
      expect(cookie).toContain('medicita_token=');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).not.toContain('Secure'); // solo en producción
      const maxAge = Number(/Max-Age=(\d+)/.exec(cookie)?.[1]);
      expect(maxAge).toBeGreaterThan(8 * 3600 - 60);
      expect(maxAge).toBeLessThanOrEqual(8 * 3600);

      expect(res.body.user.permissions).toEqual([
        'citas:ver',
        'medicos:buscar',
        'pagos:ver',
      ]);
      expect(await auditActions(ctx.prisma)).toEqual([
        AuditAction.LOGIN_SUCCESS,
      ]);
    });

    it('TC-07b la sesión permite consultar /auth/me', async () => {
      const agent = await loginAs(ctx.app, 'paciente@correo.do');
      const res = await agent.get('/api/auth/me').expect(200);
      expect(res.body.user).toMatchObject({
        email: 'paciente@correo.do',
        role: 'PACIENTE',
        roleLabel: 'Paciente',
      });
    });

    it('TC-08 rechaza credenciales incorrectas con mensaje genérico y audita LOGIN_FAILED', async () => {
      const wrongPassword = await http()
        .post('/api/auth/login')
        .send({ email: 'paciente@correo.do', password: 'Clave-Erronea-1!' })
        .expect(401);
      const unknownEmail = await http()
        .post('/api/auth/login')
        .send({ email: 'nadie@correo.do', password: STRONG_PASSWORD })
        .expect(401);

      expect(wrongPassword.body.message).toBe(
        'Correo o contraseña incorrectos.',
      );
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
      expect(setCookieHeader(wrongPassword)).toBe('');
      expect(await auditActions(ctx.prisma)).toEqual([
        AuditAction.LOGIN_FAILED,
        AuditAction.LOGIN_FAILED,
      ]);
    });

    it('TC-10 un usuario desactivado no puede iniciar sesión', async () => {
      await createUser(ctx.prisma, {
        email: 'inactivo@correo.do',
        role: Role.PACIENTE,
        isActive: false,
      });
      const res = await http()
        .post('/api/auth/login')
        .send({ email: 'inactivo@correo.do', password: STRONG_PASSWORD })
        .expect(403);
      expect(res.body.message).toBe(
        'Tu cuenta está desactivada. Contacta al administrador.',
      );
      expect(setCookieHeader(res)).toBe('');
      expect(await auditActions(ctx.prisma)).toEqual([
        AuditAction.LOGIN_FAILED,
      ]);
    });

    it('TC-11 rechaza un token alterado', async () => {
      const login = await http()
        .post('/api/auth/login')
        .send({ email: 'paciente@correo.do', password: STRONG_PASSWORD });
      const token = /medicita_token=([^;]+)/.exec(setCookieHeader(login))![1];
      const [header, payload, signature] = token.split('.');
      const forged = Buffer.from(
        JSON.stringify({
          ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
          role: 'ADMIN',
        }),
      ).toString('base64url');

      await http()
        .get('/api/users')
        .set('Cookie', `medicita_token=${header}.${forged}.${signature}`)
        .expect(401);
    });
  });

  describe('HU-03 Cierre de sesión', () => {
    it('TC-09 cierra la sesión, borra la cookie y audita LOGOUT', async () => {
      await createUser(ctx.prisma, {
        email: 'paciente@correo.do',
        role: Role.PACIENTE,
      });
      const agent = await loginAs(ctx.app, 'paciente@correo.do');
      await agent.get('/api/auth/me').expect(200);

      const res = await agent.post('/api/auth/logout').expect(200);
      expect(setCookieHeader(res)).toMatch(/medicita_token=;/);

      await agent.get('/api/auth/me').expect(401);
      expect(await auditActions(ctx.prisma)).toEqual([
        AuditAction.LOGIN_SUCCESS,
        AuditAction.LOGOUT,
        AuditAction.ACCESS_DENIED_401,
      ]);
    });
  });
});
