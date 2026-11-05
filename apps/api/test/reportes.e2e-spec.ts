import { EstadoCita, Medico, Role } from '@prisma/client';
import TestAgent from 'supertest/lib/agent';
import { createMedico, insertCita } from './citas-helpers';
import {
  createTestApp,
  createUser,
  loginAs,
  resetDatabase,
  TestContext,
} from './helpers';

/** Instante en hora de RD. */
const rd = (s: string) => new Date(`${s}:00-04:00`);

describe('Reporte de operaciones (e2e)', () => {
  let ctx: TestContext;
  let admin: TestAgent;
  let paciente: TestAgent;
  let centro: TestAgent;
  let centro2: TestAgent;
  let general: Medico;
  let cardio: Medico;
  let derma: Medico;
  let centroId: string;
  let centro2Id: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    const [, p, c, c2] = await Promise.all([
      createUser(ctx.prisma, {
        email: 'admin@medicita.test',
        role: Role.ADMIN,
      }),
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
    centroId = c.id;
    centro2Id = c2.id;
    general = await createMedico(ctx.prisma, c.id);
    cardio = await createMedico(ctx.prisma, c.id, {
      nombre: 'Dr. Ricardo Gómez',
      especialidad: 'Cardiología',
      precioConsulta: 2500,
    });
    derma = await createMedico(ctx.prisma, c2.id, {
      nombre: 'Dr. Miguel Santana',
      especialidad: 'Dermatología',
      precioConsulta: 2000,
    });

    // Datos fijos: 2–6 de noviembre de 2026 (hora de RD)
    const datos: [Medico, string, EstadoCita][] = [
      [general, '2026-11-02T08:00', 'ATENDIDA'],
      [general, '2026-11-02T08:30', 'ATENDIDA'],
      [general, '2026-11-02T09:00', 'NO_ASISTIO'],
      [cardio, '2026-11-03T10:00', 'ATENDIDA'],
      [cardio, '2026-11-03T10:30', 'CANCELADA'],
      [cardio, '2026-11-05T11:00', 'CONFIRMADA'],
      [general, '2026-11-05T16:30', 'PENDIENTE'],
      [derma, '2026-11-04T09:00', 'ATENDIDA'],
      [derma, '2026-11-06T09:00', 'CANCELADA'],
      // fuera del rango
      [general, '2026-10-20T09:00', 'ATENDIDA'],
    ];
    for (const [medico, f, estado] of datos) {
      await insertCita(ctx.prisma, {
        pacienteId: p.id,
        medico,
        fechaHora: rd(f),
        estado,
      });
    }
    [admin, paciente, centro, centro2] = await Promise.all([
      loginAs(ctx.app, 'admin@medicita.test'),
      loginAs(ctx.app, 'paciente@medicita.test'),
      loginAs(ctx.app, 'centro@medicita.test'),
      loginAs(ctx.app, 'centro2@medicita.test'),
    ]);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const RANGO = 'desde=2026-11-02&hasta=2026-11-06';

  describe('HU-15 Reporte básico de operaciones', () => {
    it('TC-41 el admin obtiene totales por estado, tasas e ingresos correctos', async () => {
      const res = await admin.get(`/api/reportes/citas?${RANGO}`).expect(200);
      expect(res.body).toMatchObject({
        total: 9,
        porEstado: {
          PENDIENTE: 1,
          CONFIRMADA: 1,
          ATENDIDA: 4,
          NO_ASISTIO: 1,
          CANCELADA: 2,
        },
        tasaAsistencia: 0.8, // 4 / (4 + 1)
        tasaCancelacion: 0.2222, // 2 / 9
        ingresos: 7500, // 1500 + 1500 + 2500 + 2000
      });
      expect(res.body.citas).toBeUndefined(); // el detalle solo va en el CSV
    });

    it('TC-41b agrupa por médico y por día (con los días sin citas)', async () => {
      const res = await admin.get(`/api/reportes/citas?${RANGO}`).expect(200);
      const porMedico = Object.fromEntries(
        res.body.porMedico.map(
          (m: { nombre: string; total: number; ingresos: number }) => [
            m.nombre,
            [m.total, m.ingresos],
          ],
        ),
      );
      expect(porMedico).toEqual({
        'Dra. Laura Fernández': [4, 3000],
        'Dr. Ricardo Gómez': [3, 2500],
        'Dr. Miguel Santana': [2, 2000],
      });
      expect(
        res.body.porDia.map((d: { fecha: string; total: number }) => [
          d.fecha,
          d.total,
        ]),
      ).toEqual([
        ['2026-11-02', 3],
        ['2026-11-03', 2],
        ['2026-11-04', 1],
        ['2026-11-05', 2],
        ['2026-11-06', 1],
      ]);
    });

    it('TC-41c filtra por centro y por médico (responsable)', async () => {
      const c2 = await admin
        .get(`/api/reportes/citas?${RANGO}&centroId=${centro2Id}`)
        .expect(200);
      expect(c2.body).toMatchObject({
        total: 2,
        ingresos: 2000,
        tasaCancelacion: 0.5,
      });
      const med = await admin
        .get(`/api/reportes/citas?${RANGO}&medicoId=${cardio.id}`)
        .expect(200);
      expect(med.body).toMatchObject({
        total: 3,
        ingresos: 2500,
        tasaAsistencia: 1,
      });
    });

    it('TC-41d el centro solo ve el reporte de su centro; el paciente recibe 403', async () => {
      const propio = await centro
        .get(`/api/reportes/citas?${RANGO}&centroId=${centro2Id}`)
        .expect(200);
      expect(propio.body).toMatchObject({ total: 7, filtros: { centroId } });
      const otro = await centro2
        .get(`/api/reportes/citas?${RANGO}`)
        .expect(200);
      expect(otro.body.total).toBe(2);
      await paciente.get('/api/reportes/citas').expect(403);
      await paciente.get('/api/reportes/citas.csv').expect(403);
    });

    it('TC-41e valida el rango de fechas', async () => {
      await admin
        .get('/api/reportes/citas?desde=2026-11-10&hasta=2026-11-01')
        .expect(400);
      await admin.get('/api/reportes/citas?desde=02-11-2026').expect(400);
    });

    it('TC-42 descarga el CSV con los totales y el detalle', async () => {
      const res = await admin
        .get(`/api/reportes/citas.csv?${RANGO}`)
        .expect(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="reporte-citas_2026-11-02_2026-11-06.csv"',
      );
      const lineas = res.text.replace(/^\uFEFF/, '').split('\r\n');
      expect(lineas).toEqual(
        expect.arrayContaining([
          'Total de citas,9',
          'Atendida,4',
          'Cancelada,2',
          'Tasa de asistencia,80.0%',
          'Tasa de cancelación,22.2%',
          'Ingresos de citas atendidas (DOP),7500.00',
        ]),
      );
      const detalle = lineas.slice(lineas.indexOf('Detalle de citas') + 2);
      expect(detalle).toHaveLength(9);
      expect(detalle[0]).toMatch(
        /^CIT-\d{4},2026-11-02 08:00,Atendida,CONSULTA,.*,Dra\. Laura Fernández,Medicina General,Centro Uno,1500\.00$/,
      );
    });
  });
});
