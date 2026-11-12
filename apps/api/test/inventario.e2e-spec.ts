import { Medico, Role } from '@prisma/client';
import TestAgent from 'supertest/lib/agent';
import { AuditAction } from '../src/audit/audit-actions';
import { sumarDias } from '../src/common/rd-time';
import { hoyRd } from '../src/inventario/inventario-rules';
import { createMedico, HORA_MS, insertCita } from './citas-helpers';
import {
  createTestApp,
  createUser,
  loginAs,
  resetDatabase,
  TestContext,
} from './helpers';

const venceEn = (dias: number) => sumarDias(hoyRd(), dias);
const futuroIso = (dias: number) =>
  new Date(Date.now() + dias * 24 * HORA_MS).toISOString();

describe('Inventario: gestión logística (e2e)', () => {
  let ctx: TestContext;
  let admin: TestAgent;
  let paciente: TestAgent;
  let centro: TestAgent;
  let centro2: TestAgent;
  let ids: Record<'admin' | 'paciente' | 'centro' | 'centro2', string>;
  let medico: Medico;
  let medicoInactivo: Medico;
  let medicoOtro: Medico;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    const u = await Promise.all([
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
    ids = {
      admin: u[0].id,
      paciente: u[1].id,
      centro: u[2].id,
      centro2: u[3].id,
    };
    medico = await createMedico(ctx.prisma, ids.centro);
    medicoInactivo = await createMedico(ctx.prisma, ids.centro, {
      nombre: 'Dr. Inactivo',
      activo: false,
    });
    medicoOtro = await createMedico(ctx.prisma, ids.centro2, {
      nombre: 'Dr. Otro Centro',
    });
    [admin, paciente, centro, centro2] = await Promise.all([
      loginAs(ctx.app, 'admin@medicita.test'),
      loginAs(ctx.app, 'paciente@medicita.test'),
      loginAs(ctx.app, 'centro@medicita.test'),
      loginAs(ctx.app, 'centro2@medicita.test'),
    ]);
    await ctx.prisma.auditLog.deleteMany();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const nuevoInsumo = async (
    agent: TestAgent,
    o: Record<string, unknown> = {},
  ): Promise<{ id: string; codigo: string }> =>
    (
      await agent
        .post('/api/recursos')
        .send({
          nombre: 'Gasas estériles',
          tipo: 'INSUMO',
          categoria: 'MATERIAL_MEDICO',
          unidad: 'paquete',
          stockMinimo: 5,
          costoUnitario: 85,
          ...o,
        })
        .expect(201)
    ).body;

  const nuevoEquipo = async (o: Record<string, unknown> = {}) =>
    (
      await centro
        .post('/api/recursos')
        .send({
          nombre: 'Electrocardiógrafo',
          tipo: 'EQUIPO',
          categoria: 'EQUIPO_MEDICO',
          unidad: 'unidad',
          costoUnitario: 185000,
          numeroSerie: 'ECG-1',
          ...o,
        })
        .expect(201)
    ).body as { id: string; codigo: string };

  const entrada = (agent: TestAgent, body: Record<string, unknown>) =>
    agent.post('/api/movimientos/entrada').send(body);
  const salida = (agent: TestAgent, body: Record<string, unknown>) =>
    agent.post('/api/movimientos/salida').send(body);
  const stock = async (id: string) =>
    (await ctx.prisma.recurso.findUniqueOrThrow({ where: { id } })).stockActual;

  describe('HU-16 Registrar y consultar recursos', () => {
    it('TC-43 el centro registra insumos y equipos (REC-0001…); nombre repetido 409; paciente y admin no crean (403)', async () => {
      const ins = await nuevoInsumo(centro);
      expect(ins).toMatchObject({
        codigo: 'REC-0001',
        stockActual: 0,
        activo: true,
      });
      const eq = await nuevoEquipo();
      expect(eq).toMatchObject({
        codigo: 'REC-0002',
        estadoEquipo: 'DISPONIBLE',
        stockActual: null,
      });
      const dup = await centro
        .post('/api/recursos')
        .send({
          nombre: 'Gasas estériles',
          tipo: 'INSUMO',
          categoria: 'OTRO',
          unidad: 'u',
          costoUnitario: 1,
        })
        .expect(409);
      expect(dup.body.message).toBe(
        'Ya existe un recurso con ese nombre en tu centro.',
      );
      // El mismo nombre en otro centro sí se permite
      await nuevoInsumo(centro2);
      await paciente.get('/api/recursos').expect(403);
      await admin
        .post('/api/recursos')
        .send({
          nombre: 'X',
          tipo: 'INSUMO',
          categoria: 'OTRO',
          unidad: 'u',
          costoUnitario: 1,
        })
        .expect(403);
      const acciones = (await ctx.prisma.auditLog.findMany()).map(
        (l) => l.action,
      );
      expect(
        acciones.filter((a) => a === AuditAction.RECURSO_CREADO),
      ).toHaveLength(3);
      expect(acciones).toContain(AuditAction.ACCESS_DENIED_403);
    });

    it('TC-44 consulta con filtros, edición y baja; el admin ve todos los centros', async () => {
      const gasas = await nuevoInsumo(centro);
      await nuevoInsumo(centro, {
        nombre: 'Paracetamol 500 mg',
        categoria: 'MEDICAMENTO',
        requiereVencimiento: true,
      });
      await nuevoEquipo();
      await nuevoInsumo(centro2, { nombre: 'Hisopos' });

      expect((await centro.get('/api/recursos').expect(200)).body.total).toBe(
        3,
      );
      expect(
        (await centro.get('/api/recursos?tipo=EQUIPO').expect(200)).body.total,
      ).toBe(1);
      expect(
        (await centro.get('/api/recursos?categoria=MEDICAMENTO').expect(200))
          .body.total,
      ).toBe(1);
      expect(
        (await centro.get('/api/recursos?texto=REC-0001').expect(200)).body
          .items[0].nombre,
      ).toBe('Gasas estériles');
      // Todos los insumos nuevos (stock 0 ≤ mínimo 5) están en bajo stock
      const bajo = await centro
        .get('/api/recursos?estado=bajo_stock')
        .expect(200);
      expect(bajo.body).toMatchObject({ total: 2, resumen: { bajoStock: 2 } });
      expect(
        (await centro.get('/api/recursos?estado=disponible').expect(200)).body
          .total,
      ).toBe(1);
      expect((await admin.get('/api/recursos').expect(200)).body.total).toBe(4);
      expect(
        (await admin.get(`/api/recursos?centroId=${ids.centro2}`).expect(200))
          .body.total,
      ).toBe(1);
      await centro.get('/api/recursos?estado=agotado').expect(400);

      const edit = await centro
        .patch(`/api/recursos/${gasas.id}`)
        .send({ stockMinimo: 0, costoUnitario: 90 })
        .expect(200);
      expect(edit.body).toMatchObject({ stockMinimo: 0, costoUnitario: 90 });
      const baja = await centro
        .patch(`/api/recursos/${gasas.id}/estado`)
        .send({ activo: false })
        .expect(200);
      expect(baja.body.activo).toBe(false);
      expect(
        (await centro.get('/api/recursos?estado=inactivo').expect(200)).body
          .total,
      ).toBe(1);
      await centro
        .patch(`/api/recursos/${gasas.id}/estado`)
        .send({ activo: true })
        .expect(200);
    });

    it('TC-45 un recurso de otro centro responde 403 (auditado) para leerlo o moverlo', async () => {
      const r = await nuevoInsumo(centro);
      const leer = await centro2.get(`/api/recursos/${r.id}`).expect(403);
      expect(leer.body.message).toBe(
        'Acceso denegado: este recurso pertenece a otro centro.',
      );
      await centro2.get(`/api/recursos/${r.id}/movimientos`).expect(403);
      await entrada(centro2, { recursoId: r.id, cantidad: 5 }).expect(403);
      await centro2
        .patch(`/api/recursos/${r.id}`)
        .send({ costoUnitario: 1 })
        .expect(403);
      const logs = await ctx.prisma.auditLog.findMany({
        where: { action: AuditAction.ACCESS_DENIED_403 },
      });
      expect(logs).toHaveLength(4);
      expect(logs[0].detail).toContain(r.codigo);
      expect(await stock(r.id)).toBe(0);
    });
  });

  describe('HU-17 Entradas, salidas y ajustes', () => {
    it('TC-46 entrada: L3 exige lote y vencimiento futuro; el mismo lote suma', async () => {
      const r = await nuevoInsumo(centro, { requiereVencimiento: true });
      const sinLote = await entrada(centro, {
        recursoId: r.id,
        cantidad: 10,
      }).expect(400);
      expect(sinLote.body.message).toMatch(/requiere vencimiento/);
      const vencido = await entrada(centro, {
        recursoId: r.id,
        cantidad: 10,
        numeroLote: 'A',
        fechaVencimiento: venceEn(-1),
      }).expect(400);
      expect(vencido.body.message).toMatch(/debe ser futura/);
      await entrada(centro, {
        recursoId: r.id,
        cantidad: 0,
        numeroLote: 'A',
        fechaVencimiento: venceEn(90),
      }).expect(400);

      const ok = await entrada(centro, {
        recursoId: r.id,
        cantidad: 10,
        numeroLote: 'A',
        fechaVencimiento: venceEn(90),
        referencia: 'Fact. 123',
        costoUnitario: 95,
      }).expect(201);
      expect(ok.body[0]).toMatchObject({
        codigo: 'MOV-0001',
        tipo: 'ENTRADA',
        stockAnterior: 0,
        stockNuevo: 10,
        referencia: 'Fact. 123',
        costoUnitario: 95,
        lote: { numeroLote: 'A' },
      });
      await entrada(centro, {
        recursoId: r.id,
        cantidad: 5,
        numeroLote: 'A',
        fechaVencimiento: venceEn(90),
      }).expect(201);
      const otraFecha = await entrada(centro, {
        recursoId: r.id,
        cantidad: 5,
        numeroLote: 'A',
        fechaVencimiento: venceEn(91),
      }).expect(400);
      expect(otraFecha.body.message).toMatch(/ya existe con vencimiento/);
      expect(await stock(r.id)).toBe(15);
      const lotes = await ctx.prisma.lote.findMany({
        where: { recursoId: r.id },
      });
      expect(lotes.map((l) => [l.numeroLote, l.cantidadDisponible])).toEqual([
        ['A', 15],
      ]);
      // El costo de la entrada actualiza el último costo del recurso
      expect(
        (await centro.get(`/api/recursos/${r.id}`).expect(200)).body
          .costoUnitario,
      ).toBe(95);
    });

    it('TC-47 salida: L2 stock insuficiente 409; L3 FEFO por lotes sin tomar vencidos', async () => {
      const simple = await nuevoInsumo(centro, { nombre: 'Guantes' });
      await entrada(centro, { recursoId: simple.id, cantidad: 8 }).expect(201);
      const sin = await salida(centro, {
        recursoId: simple.id,
        cantidad: 9,
      }).expect(409);
      expect(sin.body.message).toBe('Stock insuficiente (disponible: 8).');
      await salida(centro, { recursoId: simple.id, cantidad: -1 }).expect(400);
      await salida(centro, { recursoId: simple.id, cantidad: 8 }).expect(201);
      expect(await stock(simple.id)).toBe(0);

      const r = await nuevoInsumo(centro, {
        nombre: 'Paracetamol',
        requiereVencimiento: true,
      });
      await entrada(centro, {
        recursoId: r.id,
        cantidad: 10,
        numeroLote: 'TARDE',
        fechaVencimiento: venceEn(200),
      });
      await entrada(centro, {
        recursoId: r.id,
        cantidad: 4,
        numeroLote: 'PRONTO',
        fechaVencimiento: venceEn(20),
      });
      // Un lote vencido con 50 unidades (insertado directo): nunca se toma
      await ctx.prisma.lote.create({
        data: {
          recursoId: r.id,
          numeroLote: 'VENCIDO',
          fechaVencimiento: new Date(`${venceEn(-2)}T00:00:00Z`),
          cantidadDisponible: 50,
        },
      });
      await ctx.prisma.recurso.update({
        where: { id: r.id },
        data: { stockActual: 64 },
      });

      const fefo = await salida(centro, {
        recursoId: r.id,
        cantidad: 6,
      }).expect(201);
      expect(
        fefo.body.map(
          (m: {
            lote: { numeroLote: string };
            cantidad: number;
            stockAnterior: number;
            stockNuevo: number;
          }) => [m.lote.numeroLote, m.cantidad, m.stockAnterior, m.stockNuevo],
        ),
      ).toEqual([
        ['PRONTO', 4, 64, 60],
        ['TARDE', 2, 60, 58],
      ]);
      const mucho = await salida(centro, {
        recursoId: r.id,
        cantidad: 9,
      }).expect(409);
      expect(mucho.body.message).toBe('Stock insuficiente (disponible: 8).');
      const vencido = await ctx.prisma.lote.findFirstOrThrow({
        where: { numeroLote: 'VENCIDO' },
      });
      expect(vencido.cantidadDisponible).toBe(50);
    });

    it('TC-48 ajuste: L7 exige motivo y no deja stock negativo; los lotes se ajustan uno por uno', async () => {
      const r = await nuevoInsumo(centro);
      await entrada(centro, { recursoId: r.id, cantidad: 5 });
      const aj = (body: Record<string, unknown>) =>
        centro
          .post('/api/movimientos/ajuste')
          .send({ recursoId: r.id, ...body });
      expect(
        (await aj({ sentido: 'DISMINUCION', cantidad: 1 }).expect(400)).body
          .message,
      ).toBe('El ajuste exige un motivo.');
      expect(
        (
          await aj({
            sentido: 'DISMINUCION',
            cantidad: 6,
            motivo: 'Conteo',
          }).expect(409)
        ).body.message,
      ).toBe('El ajuste dejaría el stock negativo (disponible: 5).');
      const mas = await aj({
        sentido: 'AUMENTO',
        cantidad: 2,
        motivo: 'Conteo físico',
      }).expect(201);
      expect(mas.body[0]).toMatchObject({
        tipo: 'AJUSTE',
        stockAnterior: 5,
        stockNuevo: 7,
      });

      const lotes = await nuevoInsumo(centro, {
        nombre: 'Tiras',
        requiereVencimiento: true,
      });
      await entrada(centro, {
        recursoId: lotes.id,
        cantidad: 3,
        numeroLote: 'L1',
        fechaVencimiento: venceEn(30),
      });
      const sinLote = await centro
        .post('/api/movimientos/ajuste')
        .send({
          recursoId: lotes.id,
          sentido: 'DISMINUCION',
          cantidad: 1,
          motivo: 'Dañado',
        })
        .expect(400);
      expect(sinLote.body.message).toBe('Indica el lote que vas a ajustar.');
      const loteId = (
        await ctx.prisma.lote.findFirstOrThrow({
          where: { recursoId: lotes.id },
        })
      ).id;
      await centro
        .post('/api/movimientos/ajuste')
        .send({
          recursoId: lotes.id,
          sentido: 'DISMINUCION',
          cantidad: 1,
          motivo: 'Dañado',
          loteId,
        })
        .expect(201);
      expect(
        (await ctx.prisma.lote.findUniqueOrThrow({ where: { id: loteId } }))
          .cantidadDisponible,
      ).toBe(2);
      expect(await stock(lotes.id)).toBe(2);
    });

    it('TC-49 L6 un recurso inactivo no admite movimientos (409)', async () => {
      const r = await nuevoInsumo(centro);
      await entrada(centro, { recursoId: r.id, cantidad: 5 }).expect(201);
      await centro
        .patch(`/api/recursos/${r.id}/estado`)
        .send({ activo: false })
        .expect(200);
      const e = await entrada(centro, { recursoId: r.id, cantidad: 1 }).expect(
        409,
      );
      expect(e.body.message).toMatch(/está inactivo y no admite movimientos/);
      await salida(centro, { recursoId: r.id, cantidad: 1 }).expect(409);
      expect(await stock(r.id)).toBe(5);
    });
  });

  describe('HU-18 Asignaciones y devoluciones de equipos', () => {
    it('TC-50 L4/L5: asignar, rechazos, devolver, mantenimiento y baja (como ajuste)', async () => {
      const eq = await nuevoEquipo();
      const asignar = (body: Record<string, unknown>) =>
        centro.post('/api/movimientos/asignacion').send({
          recursoId: eq.id,
          medicoId: medico.id,
          fechaDevolucionPrevista: futuroIso(7),
          ...body,
        });
      expect(
        (await asignar({ medicoId: medicoInactivo.id }).expect(400)).body
          .message,
      ).toMatch(/inactivo/);
      expect(
        (await asignar({ medicoId: medicoOtro.id }).expect(400)).body.message,
      ).toBe('El médico no pertenece a este centro.');
      expect(
        (await asignar({ fechaDevolucionPrevista: futuroIso(-1) }).expect(400))
          .body.message,
      ).toBe('La fecha de devolución prevista debe ser futura.');
      const ins = await nuevoInsumo(centro);
      await asignar({ recursoId: ins.id }).expect(400);

      const ok = await asignar({}).expect(201);
      expect(ok.body[0]).toMatchObject({
        tipo: 'ASIGNACION',
        estadoEquipoAnterior: 'DISPONIBLE',
        estadoEquipoNuevo: 'ASIGNADO',
        medico: { nombre: 'Dra. Laura Fernández' },
      });
      expect((await asignar({}).expect(409)).body.message).toMatch(
        /ya está asignado a Dra. Laura Fernández/,
      );
      await centro
        .post('/api/movimientos/ajuste')
        .send({ recursoId: eq.id, estadoEquipo: 'MANTENIMIENTO', motivo: 'x' })
        .expect(409);
      await centro
        .patch(`/api/recursos/${eq.id}/estado`)
        .send({ activo: false })
        .expect(409);

      const dev = await centro
        .post('/api/movimientos/devolucion')
        .send({ recursoId: eq.id })
        .expect(201);
      expect(dev.body[0]).toMatchObject({
        tipo: 'DEVOLUCION',
        estadoEquipoNuevo: 'DISPONIBLE',
        medico: { id: medico.id },
      });
      expect(
        (
          await centro
            .post('/api/movimientos/devolucion')
            .send({ recursoId: eq.id })
            .expect(409)
        ).body.message,
      ).toBe(
        'Solo se puede devolver un equipo asignado (estado actual: Disponible).',
      );
      await centro
        .post('/api/movimientos/ajuste')
        .send({
          recursoId: eq.id,
          estadoEquipo: 'MANTENIMIENTO',
          motivo: 'Calibración',
        })
        .expect(201);
      expect((await asignar({}).expect(409)).body.message).toMatch(
        /en mantenimiento/,
      );
      await centro
        .post('/api/movimientos/ajuste')
        .send({
          recursoId: eq.id,
          estadoEquipo: 'DISPONIBLE',
          motivo: 'Calibrado',
        })
        .expect(201);
      const baja = await centro
        .patch(`/api/recursos/${eq.id}/estado`)
        .send({ activo: false, motivo: 'Dañado' })
        .expect(200);
      expect(baja.body).toMatchObject({ activo: false, estadoEquipo: 'BAJA' });
      expect((await asignar({}).expect(409)).body.message).toMatch(
        /dado de baja/,
      );

      const tipos = (
        await ctx.prisma.movimiento.findMany({
          where: { recursoId: eq.id },
          orderBy: { createdAt: 'asc' },
        })
      ).map((m) => `${m.tipo}:${m.estadoEquipoNuevo}`);
      expect(tipos).toEqual([
        'ASIGNACION:ASIGNADO',
        'DEVOLUCION:DISPONIBLE',
        'AJUSTE:MANTENIMIENTO',
        'AJUSTE:DISPONIBLE',
        'AJUSTE:BAJA',
      ]);
    });
  });

  describe('HU-19 Validar disponibilidad', () => {
    it('TC-51 disponibilidad por lote (sin vencidos) y del equipo con su asignación', async () => {
      const r = await nuevoInsumo(centro, {
        requiereVencimiento: true,
        stockMinimo: 10,
      });
      await entrada(centro, {
        recursoId: r.id,
        cantidad: 6,
        numeroLote: 'PROX',
        fechaVencimiento: venceEn(10),
      });
      await entrada(centro, {
        recursoId: r.id,
        cantidad: 3,
        numeroLote: 'LEJOS',
        fechaVencimiento: venceEn(100),
      });
      await ctx.prisma.lote.create({
        data: {
          recursoId: r.id,
          numeroLote: 'VIEJO',
          fechaVencimiento: new Date(`${venceEn(-1)}T00:00:00Z`),
          cantidadDisponible: 4,
        },
      });
      await ctx.prisma.recurso.update({
        where: { id: r.id },
        data: { stockActual: 13 },
      });
      const d = await centro
        .get(`/api/recursos/${r.id}/disponibilidad`)
        .expect(200);
      expect(d.body).toMatchObject({
        stockActual: 13,
        disponible: 9,
        alertas: { bajoStock: true, proximoAVencer: true, vencido: true },
      });
      expect(
        d.body.lotes.map(
          (l: { numeroLote: string; estado: string; utilizable: boolean }) => [
            l.numeroLote,
            l.estado,
            l.utilizable,
          ],
        ),
      ).toEqual([
        ['VIEJO', 'VENCIDO', false],
        ['PROX', 'PROXIMO_A_VENCER', true],
        ['LEJOS', 'VIGENTE', true],
      ]);

      const eq = await nuevoEquipo();
      await centro
        .post('/api/movimientos/asignacion')
        .send({
          recursoId: eq.id,
          medicoId: medico.id,
          fechaDevolucionPrevista: futuroIso(3),
        })
        .expect(201);
      const de = await admin
        .get(`/api/recursos/${eq.id}/disponibilidad`)
        .expect(200);
      expect(de.body).toMatchObject({
        estadoEquipo: 'ASIGNADO',
        disponible: false,
        medicoAsignado: { nombre: 'Dra. Laura Fernández' },
        devolucionAtrasada: false,
      });
    });
  });

  describe('HU-20 Historial de movimientos', () => {
    it('TC-52 historial completo y en orden; filtros; los movimientos no se editan ni se borran', async () => {
      const r = await nuevoInsumo(centro);
      await entrada(centro, { recursoId: r.id, cantidad: 10 });
      await salida(centro, {
        recursoId: r.id,
        cantidad: 3,
        motivo: 'Curaciones',
      });
      await centro.post('/api/movimientos/ajuste').send({
        recursoId: r.id,
        sentido: 'DISMINUCION',
        cantidad: 2,
        motivo: 'Dañados',
      });
      await salida(centro, { recursoId: r.id, cantidad: 1 });

      const h = await centro
        .get(`/api/recursos/${r.id}/movimientos`)
        .expect(200);
      expect(
        h.body.map(
          (m: {
            codigo: string;
            tipo: string;
            stockAnterior: number;
            stockNuevo: number;
            usuario: { email: string };
          }) =>
            `${m.codigo} ${m.tipo} ${m.stockAnterior}->${m.stockNuevo} ${m.usuario.email}`,
        ),
      ).toEqual([
        'MOV-0001 ENTRADA 0->10 centro@medicita.test',
        'MOV-0002 SALIDA 10->7 centro@medicita.test',
        'MOV-0003 AJUSTE 7->5 centro@medicita.test',
        'MOV-0004 SALIDA 5->4 centro@medicita.test',
      ]);
      await admin.get(`/api/recursos/${r.id}/movimientos`).expect(200);

      const eq = await nuevoEquipo();
      await centro.post('/api/movimientos/asignacion').send({
        recursoId: eq.id,
        medicoId: medico.id,
        fechaDevolucionPrevista: futuroIso(3),
      });
      expect(
        (await centro.get('/api/movimientos?tipo=SALIDA').expect(200)).body
          .total,
      ).toBe(2);
      expect(
        (await centro.get(`/api/movimientos?medicoId=${medico.id}`).expect(200))
          .body.total,
      ).toBe(1);
      expect(
        (await centro.get(`/api/movimientos?recursoId=${r.id}`).expect(200))
          .body.total,
      ).toBe(4);
      expect(
        (
          await centro
            .get(`/api/movimientos?desde=${hoyRd()}&hasta=${hoyRd()}`)
            .expect(200)
        ).body.total,
      ).toBe(5);
      expect(
        (await centro.get(`/api/movimientos?hasta=${venceEn(-1)}`).expect(200))
          .body.total,
      ).toBe(0);
      expect(
        (await centro.get('/api/movimientos?usuario=centro@').expect(200)).body
          .total,
      ).toBe(5);
      expect(
        (await centro2.get('/api/movimientos').expect(200)).body.total,
      ).toBe(0);
      expect((await admin.get('/api/movimientos').expect(200)).body.total).toBe(
        5,
      );
      await paciente.get('/api/movimientos').expect(403);

      // Inmutables: no existen rutas para editarlos o borrarlos
      const id = h.body[0].id;
      await centro
        .patch(`/api/movimientos/${id}`)
        .send({ cantidad: 1 })
        .expect(404);
      await centro.delete(`/api/movimientos/${id}`).expect(404);
      expect(await ctx.prisma.movimiento.count()).toBe(5);
      expect(
        (
          await ctx.prisma.auditLog.findMany({
            where: { action: { startsWith: 'MOV_' } },
          })
        ).length,
      ).toBe(5);
    });
  });

  describe('HU-17 / L8 Insumos usados en una cita', () => {
    it('TC-53 consumo atómico ligado a una cita ATENDIDA; pendiente 409; otro centro 403', async () => {
      const gasas = await nuevoInsumo(centro);
      const guantes = await nuevoInsumo(centro, { nombre: 'Guantes' });
      await entrada(centro, { recursoId: gasas.id, cantidad: 10 });
      await entrada(centro, { recursoId: guantes.id, cantidad: 1 });
      const pasada = new Date(Date.now() - 2 * HORA_MS);
      const atendida = await insertCita(ctx.prisma, {
        pacienteId: ids.paciente,
        medico,
        fechaHora: pasada,
        estado: 'ATENDIDA',
      });
      const pendiente = await insertCita(ctx.prisma, {
        pacienteId: ids.paciente,
        medico,
        fechaHora: new Date(Date.now() + 48 * HORA_MS),
        estado: 'PENDIENTE',
      });
      const otra = await insertCita(ctx.prisma, {
        pacienteId: ids.paciente,
        medico: medicoOtro,
        fechaHora: pasada,
        estado: 'ATENDIDA',
      });

      // Todo o nada: el segundo insumo no alcanza → no se registra ninguno
      const falla = await centro
        .post('/api/movimientos/consumo')
        .send({
          citaId: atendida.id,
          items: [
            { recursoId: gasas.id, cantidad: 2 },
            { recursoId: guantes.id, cantidad: 3 },
          ],
        })
        .expect(409);
      expect(falla.body.message).toBe('Stock insuficiente (disponible: 1).');
      expect(await stock(gasas.id)).toBe(10);

      const ok = await centro
        .post('/api/movimientos/consumo')
        .send({
          citaId: atendida.id,
          items: [
            { recursoId: gasas.id, cantidad: 2 },
            { recursoId: guantes.id, cantidad: 1 },
          ],
        })
        .expect(201);
      expect(
        ok.body.map(
          (m: { tipo: string; cita: { id: string }; motivo: string }) => [
            m.tipo,
            m.cita.id,
            m.motivo,
          ],
        ),
      ).toEqual([
        ['SALIDA', atendida.id, `Consumo en la cita ${atendida.codigo}`],
        ['SALIDA', atendida.id, `Consumo en la cita ${atendida.codigo}`],
      ]);
      expect(
        (await centro.get(`/api/movimientos?citaId=${atendida.id}`).expect(200))
          .body.total,
      ).toBe(2);

      const p = await salida(centro, {
        recursoId: gasas.id,
        cantidad: 1,
        citaId: pendiente.id,
      }).expect(409);
      expect(p.body.message).toMatch(/cita Atendida .* está Pendiente/);
      const o = await centro
        .post('/api/movimientos/consumo')
        .send({
          citaId: otra.id,
          items: [{ recursoId: gasas.id, cantidad: 1 }],
        })
        .expect(403);
      expect(o.body.message).toBe(
        'Acceso denegado: la cita pertenece a otro centro.',
      );
      expect(await stock(gasas.id)).toBe(8);
    });
  });

  describe('L9 Concurrencia', () => {
    it('TC-54 cinco salidas simultáneas de 3 con stock 7: solo 2 pasan y el stock nunca queda negativo', async () => {
      const r = await nuevoInsumo(centro);
      await entrada(centro, { recursoId: r.id, cantidad: 7 }).expect(201);
      const res = await Promise.all(
        [1, 2, 3, 4, 5].map(() =>
          salida(centro, { recursoId: r.id, cantidad: 3 }),
        ),
      );
      const codigos = res.map((x) => x.status).sort();
      expect(codigos).toEqual([201, 201, 409, 409, 409]);
      expect(await stock(r.id)).toBe(1);
      const salidas = await ctx.prisma.movimiento.findMany({
        where: { recursoId: r.id, tipo: 'SALIDA' },
        orderBy: { codigo: 'asc' },
      });
      expect(salidas.map((m) => [m.stockAnterior, m.stockNuevo])).toEqual([
        [7, 4],
        [4, 1],
      ]);
    });
  });

  describe('HU-21 Reportes de existencias y de movimientos', () => {
    const preparar = async () => {
      const gasas = await nuevoInsumo(centro, {
        costoUnitario: 100,
        stockMinimo: 5,
      });
      const para = await nuevoInsumo(centro, {
        nombre: 'Paracetamol',
        requiereVencimiento: true,
        costoUnitario: 50,
        stockMinimo: 2,
      });
      const eq = await nuevoEquipo({ costoUnitario: 10000 });
      await nuevoEquipo({ nombre: 'Tensiómetro', costoUnitario: 3000 });
      await nuevoInsumo(centro2, { nombre: 'Hisopos', costoUnitario: 10 });
      await entrada(centro, { recursoId: gasas.id, cantidad: 4 }); // bajo stock (4 ≤ 5)
      await entrada(centro, {
        recursoId: para.id,
        cantidad: 10,
        numeroLote: 'P1',
        fechaVencimiento: venceEn(15),
      });
      await ctx.prisma.lote.create({
        data: {
          recursoId: para.id,
          numeroLote: 'V1',
          fechaVencimiento: new Date(`${venceEn(-3)}T00:00:00Z`),
          cantidadDisponible: 6,
        },
      });
      await ctx.prisma.recurso.update({
        where: { id: para.id },
        data: { stockActual: 16 },
      });
      await salida(centro, { recursoId: para.id, cantidad: 2 });
      await centro.post('/api/movimientos/asignacion').send({
        recursoId: eq.id,
        medicoId: medico.id,
        fechaDevolucionPrevista: futuroIso(2),
      });
      return { gasas, para };
    };

    it('TC-55 existencias: valor total, bajo stock, próximo a vencer, vencido y equipos por estado', async () => {
      await preparar();
      const r = await centro.get('/api/reportes/existencias').expect(200);
      expect(r.body.totales).toMatchObject({
        recursos: 4,
        insumos: 2,
        equipos: 2,
        valorInsumos: 1100, // 4 × 100 + 14 × 50
        valorEquipos: 13000,
        valorTotal: 14100,
        bajoStock: 1,
        proximoAVencer: 1,
        unidadesProximasAVencer: 8,
        vencido: 1,
        unidadesVencidas: 6,
        valorVencido: 300,
      });
      expect(r.body.equiposPorEstado).toEqual({
        DISPONIBLE: 1,
        ASIGNADO: 1,
        MANTENIMIENTO: 0,
        BAJA: 0,
      });
      const global = await admin.get('/api/reportes/existencias').expect(200);
      expect(global.body.totales.recursos).toBe(5);
      const soloC2 = await centro2
        .get(`/api/reportes/existencias?centroId=${ids.centro}`)
        .expect(200);
      expect(soloC2.body.totales).toMatchObject({ recursos: 1, valorTotal: 0 });
      await paciente.get('/api/reportes/existencias').expect(403);
    });

    it('TC-56 movimientos por tipo, por recurso, por día y consumo; CSV de ambos reportes', async () => {
      const { gasas } = await preparar();
      const cita = await insertCita(ctx.prisma, {
        pacienteId: ids.paciente,
        medico,
        fechaHora: new Date(Date.now() - HORA_MS),
        estado: 'ATENDIDA',
      });
      await centro
        .post('/api/movimientos/consumo')
        .send({
          citaId: cita.id,
          items: [{ recursoId: gasas.id, cantidad: 1 }],
        })
        .expect(201);

      const hoy = hoyRd();
      const r = await centro
        .get(`/api/reportes/movimientos?desde=${venceEn(-2)}&hasta=${hoy}`)
        .expect(200);
      expect(r.body.totales).toMatchObject({
        movimientos: 5,
        unidadesEntrada: 14,
        unidadesSalida: 3,
        valorEntradas: 900, // 4 × 100 + 10 × 50
        valorSalidas: 200, // 2 × 50 + 1 × 100
        citasConConsumo: 1,
        valorConsumoCitas: 100,
      });
      expect(r.body.porTipo.ASIGNACION).toEqual({
        movimientos: 1,
        unidades: 1,
        valor: 0,
      });
      expect(r.body.porDia).toHaveLength(3);
      expect(r.body.porDia[2]).toMatchObject({
        fecha: hoy,
        entradas: 14,
        salidas: 3,
        equipos: 1,
      });
      expect(r.body.consumoPorCita[0]).toMatchObject({
        codigo: cita.codigo,
        total: 100,
      });
      await centro
        .get('/api/reportes/movimientos?desde=2026-12-10&hasta=2026-12-01')
        .expect(400);

      const csv = await centro
        .get(`/api/reportes/movimientos.csv?desde=${venceEn(-2)}&hasta=${hoy}`)
        .expect(200);
      expect(csv.headers['content-type']).toMatch(/text\/csv/);
      expect(csv.headers['content-disposition']).toContain(
        `movimientos_${venceEn(-2)}_${hoy}.csv`,
      );
      const lineas = csv.text.replace(/^\uFEFF/, '').split('\r\n');
      expect(lineas).toEqual(
        expect.arrayContaining([
          'Movimientos,5',
          'Unidades que entraron,14',
          'Valor consumido en citas (DOP),100.00',
        ]),
      );
      const ex = await centro.get('/api/reportes/existencias.csv').expect(200);
      // El consumo de la cita bajó las gasas de 4 a 3: 3 × 100 + 14 × 50 + 13 000
      expect(ex.text).toContain('Valor total del inventario (DOP),14000.00');
      expect(ex.text).toContain('Vencido (lotes),1');
    });
  });
});
