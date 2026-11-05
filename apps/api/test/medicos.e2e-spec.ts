import { Role } from '@prisma/client';
import TestAgent from 'supertest/lib/agent';
import { AuditAction } from '../src/audit/audit-actions';
import {
  createMedico,
  diaHabil,
  insertCita,
  proximoSabado,
  turno,
} from './citas-helpers';
import {
  createTestApp,
  createUser,
  loginAs,
  resetDatabase,
  TestContext,
} from './helpers';

describe('Médicos y horarios (e2e)', () => {
  let ctx: TestContext;
  let paciente: TestAgent;
  let centro: TestAgent;
  let centro2: TestAgent;
  let ids: Record<'paciente' | 'centro' | 'centro2', string>;

  const nuevo = {
    nombre: 'Dr. Ricardo Gómez',
    especialidad: 'Cardiología',
    precioConsulta: 2500,
    duracionMin: 30,
    diasSemana: [1, 2, 3, 4, 5],
    horaInicio: '08:00',
    horaFin: '17:00',
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    const [p, c, c2] = await Promise.all([
      createUser(ctx.prisma, {
        email: 'paciente@medicita.test',
        role: Role.PACIENTE,
      }),
      createUser(ctx.prisma, {
        email: 'centro@medicita.test',
        role: Role.CENTRO_MEDICO,
        fullName: 'Centro Uno',
      }),
      createUser(ctx.prisma, {
        email: 'centro2@medicita.test',
        role: Role.CENTRO_MEDICO,
        fullName: 'Centro Dos',
      }),
    ]);
    ids = { paciente: p.id, centro: c.id, centro2: c2.id };
    paciente = await loginAs(ctx.app, 'paciente@medicita.test');
    centro = await loginAs(ctx.app, 'centro@medicita.test');
    centro2 = await loginAs(ctx.app, 'centro2@medicita.test');
    await ctx.prisma.auditLog.deleteMany();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('HU-09 Gestión de médicos y horarios', () => {
    it('TC-23 el centro crea un médico (201), queda asociado a su centro y se audita', async () => {
      const res = await centro.post('/api/medicos').send(nuevo).expect(201);
      expect(res.body).toMatchObject({
        nombre: 'Dr. Ricardo Gómez',
        precioConsulta: 2500,
        activo: true,
        horarioTexto: 'lunes a viernes, 08:00 a 17:00',
        centro: { id: ids.centro, fullName: 'Centro Uno' },
      });
      const log = await ctx.prisma.auditLog.findFirstOrThrow();
      expect(log.action).toBe(AuditAction.MEDICO_CREADO);
    });

    it('TC-23b el paciente no puede crear médicos (403)', async () => {
      await paciente.post('/api/medicos').send(nuevo).expect(403);
    });

    it('TC-24 valida el horario y los datos con mensajes claros (400)', async () => {
      const r1 = await centro
        .post('/api/medicos')
        .send({ ...nuevo, horaInicio: '17:00', horaFin: '08:00' })
        .expect(400);
      expect(r1.body.message).toMatch(/hora de fin debe ser posterior/);
      const r2 = await centro
        .post('/api/medicos')
        .send({
          ...nuevo,
          diasSemana: [],
          precioConsulta: -5,
          horaInicio: '8am',
        })
        .expect(400);
      expect(r2.body.message).toEqual(
        expect.arrayContaining([
          'Elige al menos un día de atención.',
          'El precio no puede ser negativo.',
          'La hora debe tener el formato HH:mm (por ejemplo 08:00).',
        ]),
      );
    });

    it('TC-25 el centro edita su médico; otro centro recibe 403 auditado', async () => {
      const m = await createMedico(ctx.prisma, ids.centro);
      const res = await centro
        .patch(`/api/medicos/${m.id}`)
        .send({ precioConsulta: 1800, horaFin: '13:00' })
        .expect(200);
      expect(res.body).toMatchObject({
        precioConsulta: 1800,
        horaFin: '13:00',
      });

      await centro2
        .patch(`/api/medicos/${m.id}`)
        .send({ precioConsulta: 1 })
        .expect(403);
      const denegado = await ctx.prisma.auditLog.findFirstOrThrow({
        where: { action: AuditAction.ACCESS_DENIED_403 },
      });
      expect(denegado.userId).toBe(ids.centro2);
    });

    it('TC-26 activar y desactivar: el paciente deja de ver al médico inactivo', async () => {
      const m = await createMedico(ctx.prisma, ids.centro);
      await centro
        .patch(`/api/medicos/${m.id}/estado`)
        .send({ activo: false })
        .expect(200);
      let lista = await paciente.get('/api/medicos').expect(200);
      expect(lista.body.total).toBe(0);
      // El centro sí lo ve (inactivo)
      const propios = await centro.get('/api/medicos').expect(200);
      expect(propios.body.items[0]).toMatchObject({ id: m.id, activo: false });
      // Repetir el mismo estado es un error claro
      const rep = await centro
        .patch(`/api/medicos/${m.id}/estado`)
        .send({ activo: false })
        .expect(400);
      expect(rep.body.message).toBe('El médico ya está inactivo.');

      await centro
        .patch(`/api/medicos/${m.id}/estado`)
        .send({ activo: true })
        .expect(200);
      lista = await paciente.get('/api/medicos').expect(200);
      expect(lista.body.total).toBe(1);
      expect(
        (await ctx.prisma.auditLog.findMany()).map((l) => l.action),
      ).toEqual(
        expect.arrayContaining([
          AuditAction.MEDICO_DESACTIVADO,
          AuditAction.MEDICO_ACTIVADO,
        ]),
      );
    });

    it('TC-26b cualquier usuario autenticado busca por especialidad; el centro ve solo los suyos', async () => {
      await createMedico(ctx.prisma, ids.centro);
      await createMedico(ctx.prisma, ids.centro, {
        nombre: 'Dr. Ricardo Gómez',
        especialidad: 'Cardiología',
      });
      await createMedico(ctx.prisma, ids.centro2, {
        nombre: 'Dr. Miguel Santana',
        especialidad: 'Cardiología',
      });
      const res = await paciente
        .get('/api/medicos?especialidad=cardiología')
        .expect(200);
      expect(
        res.body.items.map((m: { nombre: string }) => m.nombre).sort(),
      ).toEqual(['Dr. Miguel Santana', 'Dr. Ricardo Gómez']);
      const esp = await paciente.get('/api/medicos/especialidades').expect(200);
      expect(esp.body).toEqual(['Cardiología', 'Medicina General']);
      const propios = await centro2.get('/api/medicos').expect(200);
      expect(propios.body.total).toBe(1);
    });

    it('TC-27 la disponibilidad marca los turnos ocupados y los días sin atención', async () => {
      const m = await createMedico(ctx.prisma, ids.centro);
      const fecha = diaHabil(3);
      await insertCita(ctx.prisma, {
        pacienteId: ids.paciente,
        medico: m,
        fechaHora: new Date(turno(fecha, '09:00')),
      });
      const res = await paciente
        .get(`/api/medicos/${m.id}/disponibilidad?fecha=${fecha}`)
        .expect(200);
      expect(res.body.atiende).toBe(true);
      expect(res.body.slots).toHaveLength(18); // 08:00 … 16:30
      const nueve = res.body.slots.find(
        (s: { hora: string }) => s.hora === '09:00',
      );
      expect(nueve).toMatchObject({ disponible: false, motivo: 'ocupado' });
      expect(
        res.body.slots.filter((s: { disponible: boolean }) => s.disponible),
      ).toHaveLength(17);

      const sabado = await paciente
        .get(`/api/medicos/${m.id}/disponibilidad?fecha=${proximoSabado()}`)
        .expect(200);
      expect(sabado.body).toMatchObject({ atiende: false, slots: [] });

      await paciente
        .get(`/api/medicos/${m.id}/disponibilidad?fecha=2026-02-31`)
        .expect(400);
    });
  });
});
