import { Medico, Role } from '@prisma/client';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { AuditAction } from '../src/audit/audit-actions';
import {
  createMedico,
  diaHabil,
  habilesDespues,
  HORA_MS,
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

describe('Citas: gestión operativa (e2e)', () => {
  let ctx: TestContext;
  let admin: TestAgent;
  let paciente: TestAgent;
  let paciente2: TestAgent;
  let centro: TestAgent;
  let centro2: TestAgent;
  let ids: Record<
    'admin' | 'paciente' | 'paciente2' | 'centro' | 'centro2',
    string
  >;
  let medico: Medico;
  let cardio: Medico;
  let derma: Medico;
  const http = () => request(ctx.app.getHttpServer());

  const fecha = diaHabil(3);
  const fecha2 = habilesDespues(fecha, 2);

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    const users = await Promise.all([
      createUser(ctx.prisma, {
        email: 'admin@medicita.test',
        role: Role.ADMIN,
      }),
      createUser(ctx.prisma, {
        email: 'paciente@medicita.test',
        role: Role.PACIENTE,
        fullName: 'María Pérez',
      }),
      createUser(ctx.prisma, {
        email: 'paciente2@medicita.test',
        role: Role.PACIENTE,
        fullName: 'Juan Rodríguez',
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
    ids = {
      admin: users[0].id,
      paciente: users[1].id,
      paciente2: users[2].id,
      centro: users[3].id,
      centro2: users[4].id,
    };
    medico = await createMedico(ctx.prisma, ids.centro);
    cardio = await createMedico(ctx.prisma, ids.centro, {
      nombre: 'Dr. Ricardo Gómez',
      especialidad: 'Cardiología',
      precioConsulta: 2500,
    });
    derma = await createMedico(ctx.prisma, ids.centro2, {
      nombre: 'Dr. Miguel Santana',
      especialidad: 'Dermatología',
      precioConsulta: 2000,
    });
    [admin, paciente, paciente2, centro, centro2] = await Promise.all([
      loginAs(ctx.app, 'admin@medicita.test'),
      loginAs(ctx.app, 'paciente@medicita.test'),
      loginAs(ctx.app, 'paciente2@medicita.test'),
      loginAs(ctx.app, 'centro@medicita.test'),
      loginAs(ctx.app, 'centro2@medicita.test'),
    ]);
    await ctx.prisma.auditLog.deleteMany();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const agendar = (
    agent: TestAgent,
    m: Medico = medico,
    hora = '09:00',
    dia = fecha,
  ) =>
    agent.post('/api/citas').send({
      medicoId: m.id,
      fechaHora: turno(dia, hora),
      tipo: 'CONSULTA',
      motivo: 'Dolor de cabeza frecuente',
    });

  const acciones = async (citaId: string) =>
    (
      await ctx.prisma.citaHistorial.findMany({
        where: { citaId },
        orderBy: { createdAt: 'asc' },
      })
    ).map((h) => h.accion);

  describe('HU-10 Agendar una cita', () => {
    it('TC-28 el paciente agenda: 201, código CIT-0001, PENDIENTE, costo copiado e historial CREADA', async () => {
      const res = await agendar(paciente).expect(201);
      expect(res.body).toMatchObject({
        codigo: 'CIT-0001',
        estado: 'PENDIENTE',
        costo: 1500,
        pacienteId: ids.paciente,
        centroId: ids.centro,
        medico: { nombre: 'Dra. Laura Fernández' },
      });
      expect(new Date(res.body.fechaHora).toISOString()).toBe(
        new Date(turno(fecha, '09:00')).toISOString(),
      );
      // El costo no cambia si luego sube el precio del médico
      await ctx.prisma.medico.update({
        where: { id: medico.id },
        data: { precioConsulta: 9999 },
      });
      const otra = await agendar(paciente, cardio, '10:00').expect(201);
      expect(otra.body.codigo).toBe('CIT-0002');
      const primera = await paciente
        .get(`/api/citas/${res.body.id}`)
        .expect(200);
      expect(primera.body.costo).toBe(1500);

      expect(await acciones(res.body.id)).toEqual(['CREADA']);
      const log = await ctx.prisma.auditLog.findFirstOrThrow({
        where: { action: AuditAction.CITA_CREADA },
      });
      expect(log.detail).toContain('CIT-0001');
    });

    it('TC-28b solo el paciente agenda: admin y centro reciben 403', async () => {
      await agendar(admin).expect(403);
      await agendar(centro).expect(403);
    });

    it('TC-37 R1, R2 y R5 se validan con mensajes claros (400)', async () => {
      const pasado = await paciente
        .post('/api/citas')
        .send({
          medicoId: medico.id,
          fechaHora: new Date(Date.now() - HORA_MS).toISOString(),
          motivo: 'x x x',
        })
        .expect(400);
      expect(pasado.body.message).toMatch(/ya pasó/);

      const lejos = await agendar(
        paciente,
        medico,
        '09:00',
        diaHabil(95),
      ).expect(400);
      expect(lejos.body.message).toMatch(/90 días/);

      const sabado = await agendar(
        paciente,
        medico,
        '09:00',
        proximoSabado(),
      ).expect(400);
      expect(sabado.body.message).toMatch(/no atiende ese día/);

      const desalineada = await agendar(paciente, medico, '09:10').expect(400);
      expect(desalineada.body.message).toMatch(/turno de 30 minutos/);

      const tarde = await agendar(paciente, medico, '18:00').expect(400);
      expect(tarde.body.message).toMatch(/fuera del horario/);

      await ctx.prisma.medico.update({
        where: { id: medico.id },
        data: { activo: false },
      });
      const inactivo = await agendar(paciente).expect(400);
      expect(inactivo.body.message).toBe(
        'Dra. Laura Fernández no está disponible para nuevas citas.',
      );
      expect(await ctx.prisma.cita.count()).toBe(0);
    });

    it('TC-36 409 por horario ocupado: del médico (R3) y del paciente (R4)', async () => {
      await agendar(paciente).expect(201);
      const r3 = await agendar(paciente2).expect(409);
      expect(r3.body.message).toMatch(/Dra. Laura Fernández ya tiene una cita/);
      const r4 = await agendar(paciente, cardio).expect(409);
      expect(r4.body.message).toMatch(/Ya tienes otra cita activa .*CIT-0001/);
    });

    it('TC-36b una cita cancelada libera el horario', async () => {
      const c = await agendar(paciente).expect(201);
      await paciente
        .post(`/api/citas/${c.body.id}/cancelar`)
        .send({ motivo: 'No puedo ir' })
        .expect(200);
      await agendar(paciente2).expect(201);
    });

    it('TC-38 R10 dos reservas simultáneas del mismo horario: una 201 y otra 409', async () => {
      const [a, b] = await Promise.all([
        agendar(paciente, medico, '11:00'),
        agendar(paciente2, medico, '11:00'),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(
        await ctx.prisma.cita.count({
          where: {
            medicoId: medico.id,
            fechaHora: new Date(turno(fecha, '11:00')),
          },
        }),
      ).toBe(1);
    });
  });

  describe('HU-11 Consultar citas y acceso por rol', () => {
    it('TC-29 la cita la ven su paciente, su centro y el admin; ajenos reciben 403 auditado', async () => {
      const { body } = await agendar(paciente).expect(201);
      await paciente.get(`/api/citas/${body.id}`).expect(200);
      await centro.get(`/api/citas/${body.id}`).expect(200);
      await admin.get(`/api/citas/${body.id}`).expect(200);

      const r = await paciente2.get(`/api/citas/${body.id}`).expect(403);
      expect(r.body.message).toBe(
        'Acceso denegado: esta cita no te pertenece.',
      );
      await centro2.get(`/api/citas/${body.id}/historial`).expect(403);
      await centro2
        .post(`/api/citas/${body.id}/confirmar`)
        .send({})
        .expect(403);

      const logs = await ctx.prisma.auditLog.findMany({
        where: { action: AuditAction.ACCESS_DENIED_403 },
      });
      expect(logs).toHaveLength(3);
      expect(logs[0].detail).toContain(body.codigo);
      expect(await acciones(body.id)).toEqual(['CREADA']); // nada cambió
    });

    it('TC-29b 404 para una cita inexistente y 401 sin sesión', async () => {
      await paciente
        .get('/api/citas/00000000-0000-4000-8000-000000000000')
        .expect(404);
      await http().get('/api/citas').expect(401);
    });

    it('TC-39 filtros por estado, fecha y responsable (médico o centro), con alcance por rol', async () => {
      const ayer = new Date(Date.now() - 24 * HORA_MS);
      await insertCita(ctx.prisma, {
        pacienteId: ids.paciente,
        medico,
        fechaHora: ayer,
        estado: 'ATENDIDA',
      });
      await agendar(paciente, medico, '09:00').expect(201);
      await agendar(paciente2, cardio, '09:00').expect(201);
      await agendar(paciente2, derma, '10:00', fecha2).expect(201);

      // Alcance: el paciente ve solo las suyas y el centro solo las de su centro
      expect((await paciente.get('/api/citas').expect(200)).body.total).toBe(2);
      expect((await centro.get('/api/citas').expect(200)).body.total).toBe(3);
      expect((await centro2.get('/api/citas').expect(200)).body.total).toBe(1);
      expect((await admin.get('/api/citas').expect(200)).body.total).toBe(4);
      // El paciente no puede ampliar su alcance con filtros
      expect(
        (
          await paciente
            .get(`/api/citas?pacienteId=${ids.paciente2}`)
            .expect(200)
        ).body.total,
      ).toBe(2);

      // Por estado (uno o varios)
      const atendidas = await admin
        .get('/api/citas?estado=ATENDIDA')
        .expect(200);
      expect(atendidas.body.total).toBe(1);
      const activas = await admin
        .get('/api/citas?estado=PENDIENTE,CONFIRMADA')
        .expect(200);
      expect(activas.body.total).toBe(3);
      await admin.get('/api/citas?estado=ABIERTA').expect(400);

      // Por fecha (días en hora de RD)
      const delDia = await admin
        .get(`/api/citas?desde=${fecha}&hasta=${fecha}`)
        .expect(200);
      expect(delDia.body.total).toBe(2);

      // Por responsable: médico y centro
      const porMedico = await admin
        .get(`/api/citas?medicoId=${cardio.id}`)
        .expect(200);
      expect(
        porMedico.body.items.map(
          (c: { medico: { nombre: string } }) => c.medico.nombre,
        ),
      ).toEqual(['Dr. Ricardo Gómez']);
      const porCentro = await admin
        .get(`/api/citas?centroId=${ids.centro2}`)
        .expect(200);
      expect(porCentro.body.total).toBe(1);

      // Texto y orden por fecha
      const texto = await admin.get('/api/citas?texto=juan').expect(200);
      expect(texto.body.total).toBe(2);
      const desc = await admin.get('/api/citas?orden=desc').expect(200);
      const fechas = desc.body.items.map(
        (c: { fechaHora: string }) => c.fechaHora,
      );
      expect([...fechas].sort().reverse()).toEqual(fechas);
      // Paginación
      const pag = await admin.get('/api/citas?pageSize=3&page=2').expect(200);
      expect(pag.body).toMatchObject({ total: 4, page: 2, pageSize: 3 });
      expect(pag.body.items).toHaveLength(1);
    });
  });

  describe('HU-12 Actualizar y reprogramar', () => {
    it('TC-30 PATCH actualiza motivo y tipo y guarda {antes, despues} en el historial', async () => {
      const { body } = await agendar(paciente).expect(201);
      const res = await paciente
        .patch(`/api/citas/${body.id}`)
        .send({ motivo: 'Control anual', tipo: 'ESTUDIO' })
        .expect(200);
      expect(res.body).toMatchObject({
        motivo: 'Control anual',
        tipo: 'ESTUDIO',
      });
      const h = await ctx.prisma.citaHistorial.findFirstOrThrow({
        where: { citaId: body.id, accion: 'ACTUALIZADA' },
      });
      expect(h.cambios).toEqual({
        motivo: {
          antes: 'Dolor de cabeza frecuente',
          despues: 'Control anual',
        },
        tipo: { antes: 'CONSULTA', despues: 'ESTUDIO' },
      });
      // No se pueden cambiar otros campos por PATCH
      await paciente
        .patch(`/api/citas/${body.id}`)
        .send({ estado: 'ATENDIDA' })
        .expect(400);
    });

    it('TC-31 reprogramar una cita confirmada la vuelve PENDIENTE; a un horario ocupado responde 409', async () => {
      const { body } = await agendar(paciente).expect(201);
      await agendar(paciente2, medico, '10:00').expect(201);
      await centro.post(`/api/citas/${body.id}/confirmar`).send({}).expect(200);

      const ocupado = await paciente
        .post(`/api/citas/${body.id}/reprogramar`)
        .send({ fechaHora: turno(fecha, '10:00') })
        .expect(409);
      expect(ocupado.body.message).toMatch(/ya tiene una cita/);

      const res = await paciente
        .post(`/api/citas/${body.id}/reprogramar`)
        .send({
          fechaHora: turno(fecha2, '15:30'),
          comentario: 'Cambio de turno',
        })
        .expect(200);
      expect(res.body.estado).toBe('PENDIENTE');
      expect(new Date(res.body.fechaHora).toISOString()).toBe(
        new Date(turno(fecha2, '15:30')).toISOString(),
      );
      // El centro también puede reprogramar
      await centro
        .post(`/api/citas/${body.id}/reprogramar`)
        .send({ fechaHora: turno(fecha2, '16:00') })
        .expect(200);
      const log = await ctx.prisma.auditLog.count({
        where: { action: AuditAction.CITA_REPROGRAMADA },
      });
      expect(log).toBe(2);
    });
  });

  describe('HU-13 Confirmar, cerrar y cancelar', () => {
    it('TC-32 solo el centro confirma (el paciente recibe 403)', async () => {
      const { body } = await agendar(paciente).expect(201);
      await paciente
        .post(`/api/citas/${body.id}/confirmar`)
        .send({})
        .expect(403);
      const res = await centro
        .post(`/api/citas/${body.id}/confirmar`)
        .send({ comentario: 'Le esperamos' })
        .expect(200);
      expect(res.body.estado).toBe('CONFIRMADA');
    });

    it('TC-33 cerrar: ATENDIDA exige notas y solo después de la hora; NO_ASISTIO sin notas', async () => {
      const futura = (await agendar(paciente).expect(201)).body;
      await centro
        .post(`/api/citas/${futura.id}/confirmar`)
        .send({})
        .expect(200);
      const antes = await centro
        .post(`/api/citas/${futura.id}/cerrar`)
        .send({ resultado: 'ATENDIDA', notas: 'Todo bien' })
        .expect(400);
      expect(antes.body.message).toMatch(/después de su hora/);

      const pasada = await insertCita(ctx.prisma, {
        pacienteId: ids.paciente,
        medico,
        fechaHora: new Date(Date.now() - 2 * HORA_MS),
        estado: 'CONFIRMADA',
      });
      const sinNotas = await centro
        .post(`/api/citas/${pasada.id}/cerrar`)
        .send({ resultado: 'ATENDIDA' })
        .expect(400);
      expect(sinNotas.body.message).toBe(
        'Para marcar la cita como atendida debes escribir las notas de cierre.',
      );
      const ok = await centro
        .post(`/api/citas/${pasada.id}/cerrar`)
        .send({ resultado: 'ATENDIDA', notas: 'Faringitis. Reposo.' })
        .expect(200);
      expect(ok.body).toMatchObject({
        estado: 'ATENDIDA',
        notasCierre: 'Faringitis. Reposo.',
      });

      const otra = await insertCita(ctx.prisma, {
        pacienteId: ids.paciente2,
        medico,
        fechaHora: new Date(Date.now() - 3 * HORA_MS),
        estado: 'CONFIRMADA',
      });
      await centro
        .post(`/api/citas/${otra.id}/cerrar`)
        .send({ resultado: 'NO_ASISTIO' })
        .expect(200);
      await paciente2
        .post(`/api/citas/${otra.id}/cerrar`)
        .send({ resultado: 'NO_ASISTIO' })
        .expect(403);
    });

    it('TC-34 cancelar: exige motivo; el paciente solo hasta 2 horas antes; el centro siempre', async () => {
      const { body } = await agendar(paciente).expect(201);
      const sinMotivo = await paciente
        .post(`/api/citas/${body.id}/cancelar`)
        .send({})
        .expect(400);
      expect(sinMotivo.body.message).toBe(
        'Debes indicar el motivo de la cancelación.',
      );

      const pronto = await insertCita(ctx.prisma, {
        pacienteId: ids.paciente,
        medico: cardio,
        fechaHora: new Date(Date.now() + HORA_MS),
        estado: 'CONFIRMADA',
      });
      const tarde = await paciente
        .post(`/api/citas/${pronto.id}/cancelar`)
        .send({ motivo: 'Me surgió algo' })
        .expect(400);
      expect(tarde.body.message).toMatch(/hasta 2 horas antes/);
      const porCentro = await centro
        .post(`/api/citas/${pronto.id}/cancelar`)
        .send({ motivo: 'El médico tuvo una emergencia' })
        .expect(200);
      expect(porCentro.body).toMatchObject({
        estado: 'CANCELADA',
        motivoCancelacion: 'El médico tuvo una emergencia',
      });

      const ok = await paciente
        .post(`/api/citas/${body.id}/cancelar`)
        .send({ motivo: 'Viaje de trabajo' })
        .expect(200);
      expect(ok.body.estado).toBe('CANCELADA');
    });

    it('TC-35 transiciones inválidas y citas cerradas responden 409', async () => {
      const { body } = await agendar(paciente).expect(201);
      await insertCita(ctx.prisma, {
        pacienteId: ids.paciente2,
        medico: cardio,
        fechaHora: new Date(Date.now() - HORA_MS),
      }).then(async (pendientePasada) => {
        const r = await centro
          .post(`/api/citas/${pendientePasada.id}/cerrar`)
          .send({ resultado: 'NO_ASISTIO' })
          .expect(409);
        expect(r.body.message).toMatch(
          /de Pendiente a No asistió. Primero hay que confirmarla/,
        );
      });

      await centro
        .post(`/api/citas/${body.id}/cancelar`)
        .send({ motivo: 'Cierre del centro' })
        .expect(200);
      const confirmar = await centro
        .post(`/api/citas/${body.id}/confirmar`)
        .send({})
        .expect(409);
      expect(confirmar.body.message).toMatch(/ya está cerrada \(Cancelada\)/);
      await paciente
        .patch(`/api/citas/${body.id}`)
        .send({ motivo: 'Otro motivo' })
        .expect(409);
      await paciente
        .post(`/api/citas/${body.id}/reprogramar`)
        .send({ fechaHora: turno(fecha2, '09:00') })
        .expect(409);
      await paciente
        .post(`/api/citas/${body.id}/cancelar`)
        .send({ motivo: 'De nuevo' })
        .expect(409);
    });
  });

  describe('HU-14 Historial de cambios', () => {
    it('TC-40 registra el historial completo y en orden, con actor y estados', async () => {
      const { body } = await agendar(paciente).expect(201);
      await centro.post(`/api/citas/${body.id}/confirmar`).send({}).expect(200);
      await paciente
        .patch(`/api/citas/${body.id}`)
        .send({ motivo: 'Dolor de espalda' })
        .expect(200);
      await paciente
        .post(`/api/citas/${body.id}/reprogramar`)
        .send({ fechaHora: turno(fecha2, '08:00') })
        .expect(200);
      await centro.post(`/api/citas/${body.id}/confirmar`).send({}).expect(200);
      await centro
        .post(`/api/citas/${body.id}/cancelar`)
        .send({ motivo: 'El paciente pidió cancelar por teléfono' })
        .expect(200);

      const res = await paciente
        .get(`/api/citas/${body.id}/historial`)
        .expect(200);
      expect(
        res.body.map(
          (h: {
            accion: string;
            estadoAnterior: string | null;
            estadoNuevo: string;
            usuario: { role: string };
          }) => [h.accion, h.estadoAnterior, h.estadoNuevo, h.usuario.role],
        ),
      ).toEqual([
        ['CREADA', null, 'PENDIENTE', 'PACIENTE'],
        ['CONFIRMADA', 'PENDIENTE', 'CONFIRMADA', 'CENTRO_MEDICO'],
        ['ACTUALIZADA', 'CONFIRMADA', 'CONFIRMADA', 'PACIENTE'],
        ['REPROGRAMADA', 'CONFIRMADA', 'PENDIENTE', 'PACIENTE'],
        ['CONFIRMADA', 'PENDIENTE', 'CONFIRMADA', 'CENTRO_MEDICO'],
        ['CANCELADA', 'CONFIRMADA', 'CANCELADA', 'CENTRO_MEDICO'],
      ]);
      const fechas = res.body.map((h: { createdAt: string }) => h.createdAt);
      expect([...fechas].sort()).toEqual(fechas);
      expect(res.body[3].cambios.fechaHora.despues).toBe(
        new Date(turno(fecha2, '08:00')).toISOString(),
      );
      expect(res.body[5].comentario).toBe(
        'El paciente pidió cancelar por teléfono',
      );

      // Cada acción quedó también en la auditoría general
      const auditadas = (
        await ctx.prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } })
      ).map((l) => l.action);
      expect(auditadas).toEqual([
        AuditAction.CITA_CREADA,
        AuditAction.CITA_CONFIRMADA,
        AuditAction.CITA_ACTUALIZADA,
        AuditAction.CITA_REPROGRAMADA,
        AuditAction.CITA_CONFIRMADA,
        AuditAction.CITA_CANCELADA,
      ]);
    });

    it('TC-40b si una regla falla no se escribe historial (misma transacción)', async () => {
      const { body } = await agendar(paciente).expect(201);
      await paciente
        .post(`/api/citas/${body.id}/reprogramar`)
        .send({ fechaHora: turno(proximoSabado(), '09:00') })
        .expect(400);
      expect(await acciones(body.id)).toEqual(['CREADA']);
    });
  });
});
