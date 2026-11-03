import { Role } from '@prisma/client';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { AuditAction } from '../src/audit/audit-actions';
import {
  createTestApp,
  createUser,
  loginAs,
  resetDatabase,
  STRONG_PASSWORD,
  TestContext,
} from './helpers';

describe('Roles, permisos y auditoría (e2e)', () => {
  let ctx: TestContext;
  let admin: TestAgent;
  let paciente: TestAgent;
  let centro: TestAgent;
  let ids: Record<'admin' | 'paciente' | 'centro', string>;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    const [a, p, c] = await Promise.all([
      createUser(ctx.prisma, {
        email: 'admin@medicita.test',
        role: Role.ADMIN,
        fullName: 'Admin Pruebas',
      }),
      createUser(ctx.prisma, {
        email: 'paciente@medicita.test',
        role: Role.PACIENTE,
        fullName: 'Paciente Pruebas',
      }),
      createUser(ctx.prisma, {
        email: 'centro@medicita.test',
        role: Role.CENTRO_MEDICO,
        fullName: 'Centro Pruebas',
      }),
    ]);
    ids = { admin: a.id, paciente: p.id, centro: c.id };
    admin = await loginAs(ctx.app, 'admin@medicita.test');
    paciente = await loginAs(ctx.app, 'paciente@medicita.test');
    centro = await loginAs(ctx.app, 'centro@medicita.test');
    await ctx.prisma.auditLog.deleteMany(); // cada prueba parte sin eventos
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const countAudit = (action: string) =>
    ctx.prisma.auditLog.count({ where: { action } });

  describe('HU-06 Acceso autorizado y no autorizado', () => {
    it.each([
      ['GET', '/api/users'],
      ['GET', '/api/audit'],
      ['GET', '/api/modules/paciente'],
      ['GET', '/api/modules/centro'],
      ['GET', '/api/auth/me'],
      ['PATCH', '/api/users/00000000-0000-4000-8000-000000000000/role'],
    ])(
      'TC-12 responde 401 sin sesión en %s %s y lo audita',
      async (method, url) => {
        const res = await http()
          [method.toLowerCase() as 'get' | 'patch'](url)
          .expect(401);
        expect(res.body.message).toBe('Debes iniciar sesión para continuar.');
        const log = await ctx.prisma.auditLog.findFirstOrThrow();
        expect(log.action).toBe(AuditAction.ACCESS_DENIED_401);
        expect(log.detail).toContain(url);
      },
    );

    it.each([
      ['paciente', '/api/users'],
      ['paciente', '/api/audit'],
      ['paciente', '/api/modules/centro'],
      ['centro', '/api/users'],
      ['centro', '/api/audit'],
      ['centro', '/api/modules/paciente'],
      ['admin', '/api/modules/paciente'],
      ['admin', '/api/modules/centro'],
    ] as const)(
      'TC-13 responde 403 a %s en %s y lo audita',
      async (who, url) => {
        const agent = { admin, paciente, centro }[who];
        const res = await agent.get(url).expect(403);
        expect(res.body.message).toBe(
          'Acceso denegado: tu perfil no tiene permiso para este recurso.',
        );
        const log = await ctx.prisma.auditLog.findFirstOrThrow();
        expect(log).toMatchObject({
          action: AuditAction.ACCESS_DENIED_403,
          userId: ids[who],
        });
      },
    );

    it.each([
      ['admin', '/api/users'],
      ['admin', '/api/audit'],
      ['admin', '/api/users/roles'],
      ['paciente', '/api/modules/paciente'],
      ['centro', '/api/modules/centro'],
    ] as const)('TC-14 permite a %s entrar a %s', async (who, url) => {
      await { admin, paciente, centro }[who].get(url).expect(200);
    });
  });

  describe('HU-04 Asignación de roles', () => {
    it('TC-15 el admin cambia el rol, queda auditado y la sesión vieja se invalida', async () => {
      const res = await admin
        .patch(`/api/users/${ids.paciente}/role`)
        .send({ role: 'CENTRO_MEDICO' })
        .expect(200);
      expect(res.body).toMatchObject({
        id: ids.paciente,
        role: 'CENTRO_MEDICO',
      });
      expect(res.body.passwordHash).toBeUndefined();

      const log = await ctx.prisma.auditLog.findFirstOrThrow({
        where: { action: AuditAction.ROLE_CHANGED },
      });
      expect(log.userId).toBe(ids.admin);
      expect(log.detail).toBe(
        'admin@medicita.test cambió el rol de paciente@medicita.test: Paciente → Centro médico',
      );
      expect(log.ip).toBeTruthy();

      // El token anterior (rol PACIENTE) ya no sirve
      await paciente.get('/api/modules/paciente').expect(401);
      // Al volver a entrar, tiene los permisos del nuevo rol
      const again = await loginAs(ctx.app, 'paciente@medicita.test');
      await again.get('/api/modules/centro').expect(200);
      await again.get('/api/modules/paciente').expect(403);
    });

    it('TC-15b un admin puede promover a otro usuario a Administrador', async () => {
      await admin
        .patch(`/api/users/${ids.centro}/role`)
        .send({ role: 'ADMIN' })
        .expect(200);
      const nuevoAdmin = await loginAs(ctx.app, 'centro@medicita.test');
      await nuevoAdmin.get('/api/users').expect(200);
    });

    it('TC-17 el admin no puede cambiar su propio rol ni desactivarse', async () => {
      const role = await admin
        .patch(`/api/users/${ids.admin}/role`)
        .send({ role: 'PACIENTE' })
        .expect(400);
      expect(role.body.message).toBe('No puedes cambiar tu propio rol.');

      const status = await admin
        .patch(`/api/users/${ids.admin}/status`)
        .send({ isActive: false })
        .expect(400);
      expect(status.body.message).toBe(
        'No puedes activar ni desactivar tu propia cuenta.',
      );

      const me = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ids.admin },
      });
      expect(me).toMatchObject({ role: 'ADMIN', isActive: true });
    });

    it('TC-18 valida el rol, el id y la existencia del usuario', async () => {
      await admin
        .patch(`/api/users/${ids.paciente}/role`)
        .send({ role: 'SUPERADMIN' })
        .expect(400);
      await admin
        .patch('/api/users/no-es-uuid/role')
        .send({ role: 'PACIENTE' })
        .expect(400);
      await admin
        .patch('/api/users/00000000-0000-4000-8000-000000000000/role')
        .send({ role: 'PACIENTE' })
        .expect(404);
      await admin
        .patch(`/api/users/${ids.paciente}/status`)
        .send({ isActive: 'no' })
        .expect(400);
      expect(await countAudit(AuditAction.ROLE_CHANGED)).toBe(0);
    });

    it('TC-19 lista y busca usuarios sin exponer contraseñas', async () => {
      const all = await admin.get('/api/users').expect(200);
      expect(all.body.total).toBe(3);
      expect(JSON.stringify(all.body)).not.toContain('passwordHash');

      const search = await admin.get('/api/users?search=PACIENTE@').expect(200);
      expect(search.body.items.map((u: { email: string }) => u.email)).toEqual([
        'paciente@medicita.test',
      ]);

      const byRole = await admin
        .get('/api/users?role=CENTRO_MEDICO')
        .expect(200);
      expect(byRole.body.total).toBe(1);

      await ctx.prisma.user.update({
        where: { id: ids.centro },
        data: { isActive: false },
      });
      const inactive = await admin
        .get('/api/users?status=inactive')
        .expect(200);
      expect(inactive.body.items[0].id).toBe(ids.centro);

      await admin.get('/api/users?role=OTRO').expect(400);
    });
  });

  describe('HU-07 Activación y desactivación', () => {
    it('TC-16 desactivar corta la sesión y bloquea el login; reactivar lo devuelve', async () => {
      await admin
        .patch(`/api/users/${ids.paciente}/status`)
        .send({ isActive: false })
        .expect(200);

      await paciente.get('/api/modules/paciente').expect(401);
      await http()
        .post('/api/auth/login')
        .send({ email: 'paciente@medicita.test', password: STRONG_PASSWORD })
        .expect(403);

      await admin
        .patch(`/api/users/${ids.paciente}/status`)
        .send({ isActive: true })
        .expect(200);
      await loginAs(ctx.app, 'paciente@medicita.test');

      expect(await countAudit(AuditAction.USER_DEACTIVATED)).toBe(1);
      expect(await countAudit(AuditAction.USER_ACTIVATED)).toBe(1);
      const deactivated = await ctx.prisma.auditLog.findFirstOrThrow({
        where: { action: AuditAction.USER_DEACTIVATED },
      });
      expect(deactivated.detail).toBe(
        'admin@medicita.test desactivó la cuenta de paciente@medicita.test',
      );
    });
  });

  describe('HU-08 Consulta de auditoría', () => {
    it('TC-20 filtra por acción, usuario y rango de fechas', async () => {
      await admin
        .patch(`/api/users/${ids.paciente}/role`)
        .send({ role: 'CENTRO_MEDICO' })
        .expect(200);
      await paciente.get('/api/audit').expect(401); // sesión vieja
      await centro.get('/api/audit').expect(403);

      const byAction = await admin
        .get('/api/audit?action=ROLE_CHANGED')
        .expect(200);
      expect(byAction.body.total).toBe(1);
      expect(byAction.body.items[0].user.email).toBe('admin@medicita.test');

      const byUser = await admin.get('/api/audit?user=centro@').expect(200);
      expect(
        byUser.body.items.map((i: { action: string }) => i.action),
      ).toEqual([AuditAction.ACCESS_DENIED_403]);

      // El filtro de usuario también encuentra al afectado (en el detalle)
      const affected = await admin
        .get('/api/audit?user=paciente@medicita.test')
        .expect(200);
      expect(
        affected.body.items.map((i: { action: string }) => i.action).sort(),
      ).toEqual([AuditAction.ACCESS_DENIED_401, AuditAction.ROLE_CHANGED]);

      const future = new Date(Date.now() + 86_400_000).toISOString();
      const empty = await admin.get(`/api/audit?from=${future}`).expect(200);
      expect(empty.body.total).toBe(0);

      const past = new Date(Date.now() - 86_400_000).toISOString();
      const inRange = await admin
        .get(`/api/audit?from=${past}&to=${future}&pageSize=2&page=1`)
        .expect(200);
      expect(inRange.body).toMatchObject({ page: 1, pageSize: 2 });
      expect(inRange.body.items).toHaveLength(2);
      expect(inRange.body.total).toBe(3);

      await admin.get('/api/audit?action=INVENTADA').expect(400);
      await admin.get('/api/audit?from=ayer').expect(400);
    });

    it('TC-21 /audit/access-denied solo acepta la clave interna del middleware', async () => {
      const body = {
        path: '/admin/usuarios',
        status: 403,
        userId: ids.paciente,
        role: 'PACIENTE',
      };
      await http().post('/api/audit/access-denied').send(body).expect(401);
      await http()
        .post('/api/audit/access-denied')
        .set('x-internal-key', 'clave-falsa')
        .send(body)
        .expect(401);
      // Ni siquiera un admin autenticado puede usarlo sin la clave
      await admin.post('/api/audit/access-denied').send(body).expect(401);
      expect(await ctx.prisma.auditLog.count()).toBe(0);

      await http()
        .post('/api/audit/access-denied')
        .set('x-internal-key', process.env.INTERNAL_API_KEY!)
        .send(body)
        .expect(204);
      const log = await ctx.prisma.auditLog.findFirstOrThrow();
      expect(log).toMatchObject({
        action: AuditAction.ACCESS_DENIED_403,
        userId: ids.paciente,
        detail: 'Web: /admin/usuarios — rol Paciente sin permiso',
      });
    });
  });
});
