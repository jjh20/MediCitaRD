/**
 * Seed del inventario (Épica 3).
 *
 * Restablece el inventario de los centros de demo: borra sus movimientos,
 * lotes y recursos, y los vuelve a crear con ~35 movimientos de las últimas
 * 3 semanas, calculados en orden para que el stock cuadre. Deja a propósito:
 * insumos en bajo stock, un lote próximo a vencer, un lote vencido, un equipo
 * asignado, uno en mantenimiento y consumos ligados a citas ATENDIDAS.
 */
import {
  CategoriaRecurso,
  EstadoCita,
  EstadoEquipo,
  Prisma,
  PrismaClient,
  TipoMovimiento,
  TipoRecurso,
  User,
} from '@prisma/client';
import {
  horaAMinutos,
  instanteRd,
  partesRd,
  sumarDias,
} from '../src/common/rd-time';

interface DefRecurso {
  clave: string;
  nombre: string;
  tipo: TipoRecurso;
  categoria: CategoriaRecurso;
  unidad: string;
  costo: number;
  minimo?: number;
  lotes?: boolean;
  serie?: string;
}

const INSUMO = TipoRecurso.INSUMO;
const EQUIPO = TipoRecurso.EQUIPO;

const RECURSOS_CENTRO_1: DefRecurso[] = [
  {
    clave: 'guantes',
    nombre: 'Guantes de nitrilo talla M',
    tipo: INSUMO,
    categoria: 'MATERIAL_MEDICO',
    unidad: 'caja',
    costo: 450,
    minimo: 10,
  },
  {
    clave: 'jeringas',
    nombre: 'Jeringas desechables 5 ml',
    tipo: INSUMO,
    categoria: 'MATERIAL_MEDICO',
    unidad: 'unidad',
    costo: 12,
    minimo: 100,
    lotes: true,
  },
  {
    clave: 'gasas',
    nombre: 'Gasas estériles 10 x 10 cm',
    tipo: INSUMO,
    categoria: 'MATERIAL_MEDICO',
    unidad: 'paquete',
    costo: 85,
    minimo: 30,
    lotes: true,
  },
  {
    clave: 'alcohol',
    nombre: 'Alcohol isopropílico 70 %',
    tipo: INSUMO,
    categoria: 'MATERIAL_MEDICO',
    unidad: 'frasco',
    costo: 175,
    minimo: 10,
  },
  {
    clave: 'tiras',
    nombre: 'Tiras reactivas de glucosa',
    tipo: INSUMO,
    categoria: 'REACTIVO',
    unidad: 'caja',
    costo: 1250,
    minimo: 5,
    lotes: true,
  },
  {
    clave: 'paracetamol',
    nombre: 'Paracetamol 500 mg',
    tipo: INSUMO,
    categoria: 'MEDICAMENTO',
    unidad: 'caja',
    costo: 220,
    minimo: 15,
    lotes: true,
  },
  {
    clave: 'mascarillas',
    nombre: 'Mascarillas quirúrgicas',
    tipo: INSUMO,
    categoria: 'MATERIAL_MEDICO',
    unidad: 'caja',
    costo: 320,
    minimo: 20,
  },
  {
    clave: 'salina',
    nombre: 'Solución salina 0.9 % 500 ml',
    tipo: INSUMO,
    categoria: 'MEDICAMENTO',
    unidad: 'frasco',
    costo: 95,
    minimo: 24,
    lotes: true,
  },
  {
    clave: 'cinta',
    nombre: 'Cinta microporosa 1"',
    tipo: INSUMO,
    categoria: 'MATERIAL_MEDICO',
    unidad: 'rollo',
    costo: 140,
    minimo: 10,
  },
  {
    clave: 'cateter',
    nombre: 'Catéter intravenoso 22G',
    tipo: INSUMO,
    categoria: 'MATERIAL_MEDICO',
    unidad: 'unidad',
    costo: 38,
    minimo: 50,
    lotes: true,
  },
  {
    clave: 'ecg',
    nombre: 'Electrocardiógrafo de 12 derivaciones',
    tipo: EQUIPO,
    categoria: 'EQUIPO_MEDICO',
    unidad: 'unidad',
    costo: 185000,
    serie: 'ECG-2024-0187',
  },
  {
    clave: 'nebulizador',
    nombre: 'Nebulizador portátil',
    tipo: EQUIPO,
    categoria: 'EQUIPO_MEDICO',
    unidad: 'unidad',
    costo: 6500,
    serie: 'NEB-5521',
  },
  {
    clave: 'tensiometro',
    nombre: 'Tensiómetro digital de brazo',
    tipo: EQUIPO,
    categoria: 'EQUIPO_MEDICO',
    unidad: 'unidad',
    costo: 4800,
    serie: 'TD-8810',
  },
  {
    clave: 'oximetro',
    nombre: 'Oxímetro de pulso',
    tipo: EQUIPO,
    categoria: 'EQUIPO_MEDICO',
    unidad: 'unidad',
    costo: 2900,
    serie: 'OXI-3307',
  },
];

const RECURSOS_CENTRO_2: DefRecurso[] = [
  {
    clave: 'c2-guantes',
    nombre: 'Guantes de látex talla S',
    tipo: INSUMO,
    categoria: 'MATERIAL_MEDICO',
    unidad: 'caja',
    costo: 380,
    minimo: 5,
  },
  {
    clave: 'c2-crema',
    nombre: 'Crema hidratante dermatológica',
    tipo: INSUMO,
    categoria: 'MEDICAMENTO',
    unidad: 'tubo',
    costo: 650,
    minimo: 6,
    lotes: true,
  },
  {
    clave: 'c2-hisopos',
    nombre: 'Hisopos estériles',
    tipo: INSUMO,
    categoria: 'MATERIAL_MEDICO',
    unidad: 'paquete',
    costo: 60,
    minimo: 10,
  },
  {
    clave: 'c2-dermatoscopio',
    nombre: 'Dermatoscopio digital',
    tipo: EQUIPO,
    categoria: 'EQUIPO_MEDICO',
    unidad: 'unidad',
    costo: 42000,
    serie: 'DER-0091',
  },
];

interface Estado {
  id: string;
  centroId: string;
  usuarioId: string;
  def: DefRecurso;
  stock: number;
  estadoEquipo: EstadoEquipo | null;
  medicoAsignadoId: string | null;
  devolucionPrevista: Date | null;
  lotes: { id: string; numero: string; vence: string; cantidad: number }[];
}

export async function seedInventario(
  prisma: PrismaClient,
  centros: { centro: User; centro2: User },
  medicos: Record<string, { id: string; nombre: string }>,
) {
  const centroIds = [centros.centro.id, centros.centro2.id];

  // Restablece: el inventario de demo se borra y se recrea (solo el seed lo hace;
  // por la API los movimientos son inmutables)
  const borrados = await prisma.movimiento.deleteMany({
    where: { centroId: { in: centroIds } },
  });
  await prisma.lote.deleteMany({
    where: { recurso: { centroId: { in: centroIds } } },
  });
  await prisma.recurso.deleteMany({ where: { centroId: { in: centroIds } } });
  if (borrados.count) {
    console.log(
      `  ↺ ${borrados.count} movimientos de inventario anteriores eliminados`,
    );
  }
  if ((await prisma.recurso.count()) === 0) {
    await prisma.$executeRawUnsafe(
      'ALTER SEQUENCE "Recurso_codigo_seq" RESTART WITH 1',
    );
  }
  if ((await prisma.movimiento.count()) === 0) {
    await prisma.$executeRawUnsafe(
      'ALTER SEQUENCE "Movimiento_codigo_seq" RESTART WITH 1',
    );
  }

  const hoy = partesRd(new Date()).fecha;
  /** Instante de hace `dias` días a la hora indicada (hora de RD). */
  const hace = (dias: number, hora = '09:00') =>
    instanteRd(sumarDias(hoy, -dias), horaAMinutos(hora));
  const venceEn = (dias: number) => sumarDias(hoy, dias);

  const estado: Record<string, Estado> = {};
  const crear = async (centro: User, defs: DefRecurso[]) => {
    for (const d of defs) {
      const r = await prisma.recurso.create({
        data: {
          centroId: centro.id,
          nombre: d.nombre,
          tipo: d.tipo,
          categoria: d.categoria,
          unidad: d.unidad,
          costoUnitario: d.costo,
          stockActual: d.tipo === INSUMO ? 0 : null,
          stockMinimo: d.tipo === INSUMO ? (d.minimo ?? 0) : null,
          requiereVencimiento: !!d.lotes,
          estadoEquipo: d.tipo === EQUIPO ? EstadoEquipo.DISPONIBLE : null,
          numeroSerie: d.serie ?? null,
          createdAt: hace(22, '08:00'),
        },
      });
      estado[d.clave] = {
        id: r.id,
        centroId: centro.id,
        usuarioId: centro.id,
        def: d,
        stock: 0,
        estadoEquipo: r.estadoEquipo,
        medicoAsignadoId: null,
        devolucionPrevista: null,
        lotes: [],
      };
    }
  };
  await crear(centros.centro, RECURSOS_CENTRO_1);
  await crear(centros.centro2, RECURSOS_CENTRO_2);

  let total = 0;
  const mov = (
    s: Estado,
    data: Omit<
      Prisma.MovimientoUncheckedCreateInput,
      'recursoId' | 'centroId' | 'usuarioId'
    >,
  ) => {
    total++;
    return prisma.movimiento.create({
      data: {
        recursoId: s.id,
        centroId: s.centroId,
        usuarioId: s.usuarioId,
        costoUnitario: s.def.costo,
        ...data,
      },
    });
  };

  const _entrada = async (
    clave: string,
    cantidad: number,
    fecha: Date,
    opt: { lote?: string; vence?: string; ref?: string } = {},
  ) => {
    const s = estado[clave];
    let loteId: string | null = null;
    if (s.def.lotes && opt.lote && opt.vence) {
      const l = await prisma.lote.create({
        data: {
          recursoId: s.id,
          numeroLote: opt.lote,
          fechaVencimiento: new Date(`${opt.vence}T00:00:00Z`),
          cantidadDisponible: 0,
          createdAt: fecha,
        },
      });
      s.lotes.push({
        id: l.id,
        numero: opt.lote,
        vence: opt.vence,
        cantidad: cantidad,
      });
      loteId = l.id;
    }
    await mov(s, {
      tipo: TipoMovimiento.ENTRADA,
      cantidad,
      stockAnterior: s.stock,
      stockNuevo: s.stock + cantidad,
      loteId,
      motivo: 'Compra a proveedor',
      referencia: opt.ref ?? 'Distribuidora Médica Caribe',
      createdAt: fecha,
    });
    s.stock += cantidad;
  };

  /** Salida con FEFO por lotes (sin vencidos a la fecha del movimiento). */
  const _salida = async (
    clave: string,
    cantidad: number,
    fecha: Date,
    motivo: string,
    citaId: string | null = null,
  ) => {
    const s = estado[clave];
    const dia = partesRd(fecha).fecha;
    if (s.def.lotes) {
      let falta = cantidad;
      const lotes = s.lotes
        .filter((l) => l.cantidad > 0 && l.vence >= dia)
        .sort((a, b) => a.vence.localeCompare(b.vence));
      for (const l of lotes) {
        if (falta === 0) break;
        const toma = Math.min(falta, l.cantidad);
        await mov(s, {
          tipo: TipoMovimiento.SALIDA,
          cantidad: toma,
          stockAnterior: s.stock,
          stockNuevo: s.stock - toma,
          loteId: l.id,
          motivo,
          citaId,
          createdAt: fecha,
        });
        l.cantidad -= toma;
        s.stock -= toma;
        falta -= toma;
      }
      if (falta > 0)
        throw new Error(`Seed: stock insuficiente de ${s.def.nombre}`);
    } else {
      if (cantidad > s.stock)
        throw new Error(`Seed: stock insuficiente de ${s.def.nombre}`);
      await mov(s, {
        tipo: TipoMovimiento.SALIDA,
        cantidad,
        stockAnterior: s.stock,
        stockNuevo: s.stock - cantidad,
        motivo,
        citaId,
        createdAt: fecha,
      });
      s.stock -= cantidad;
    }
  };

  const _ajuste = async (
    clave: string,
    sentido: 1 | -1,
    cantidad: number,
    fecha: Date,
    motivo: string,
    numeroLote?: string,
  ) => {
    const s = estado[clave];
    const lote = numeroLote
      ? s.lotes.find((l) => l.numero === numeroLote)
      : undefined;
    if (lote) lote.cantidad += sentido * cantidad;
    await mov(s, {
      tipo: TipoMovimiento.AJUSTE,
      cantidad,
      stockAnterior: s.stock,
      stockNuevo: s.stock + sentido * cantidad,
      loteId: lote?.id ?? null,
      motivo,
      createdAt: fecha,
    });
    s.stock += sentido * cantidad;
  };

  const _equipo = async (
    clave: string,
    tipo: 'ASIGNACION' | 'DEVOLUCION' | 'AJUSTE',
    nuevo: EstadoEquipo,
    fecha: Date,
    motivo: string,
    medico?: { id: string },
    devolucion?: Date,
  ) => {
    const s = estado[clave];
    await mov(s, {
      tipo,
      cantidad: 1,
      estadoEquipoAnterior: s.estadoEquipo,
      estadoEquipoNuevo: nuevo,
      medicoId:
        medico?.id ?? (tipo === 'DEVOLUCION' ? s.medicoAsignadoId : null),
      fechaDevolucionPrevista: devolucion ?? null,
      motivo,
      createdAt: fecha,
    });
    s.estadoEquipo = nuevo;
    s.medicoAsignadoId =
      nuevo === EstadoEquipo.ASIGNADO ? (medico?.id ?? null) : null;
    s.devolucionPrevista =
      nuevo === EstadoEquipo.ASIGNADO ? (devolucion ?? null) : null;
  };

  // Los eventos se encolan y se ejecutan en orden de fecha, para que el
  // stock antes y después de cada movimiento cuadre con la línea de tiempo
  const eventos: { fecha: Date; run: () => Promise<void> }[] = [];
  const encolar = (fecha: Date, run: () => Promise<void>) => {
    eventos.push({ fecha, run });
  };
  const entrada = (...a: Parameters<typeof _entrada>) =>
    encolar(a[2], () => _entrada(...a));
  const salida = (...a: Parameters<typeof _salida>) =>
    encolar(a[2], () => _salida(...a));
  const ajuste = (...a: Parameters<typeof _ajuste>) =>
    encolar(a[3], () => _ajuste(...a));
  const equipo = (...a: Parameters<typeof _equipo>) =>
    encolar(a[3], () => _equipo(...a));

  // ─── Historia del Centro Médico Esperanza (últimas 3 semanas) ─────
  const fact = 'Fact. B0100000451 · Distribuidora Médica Caribe';
  entrada('guantes', 40, hace(20, '08:30'), { ref: fact });
  entrada('jeringas', 500, hace(20, '08:35'), {
    lote: 'JER-2601',
    vence: venceEn(200),
    ref: fact,
  });
  entrada('gasas', 120, hace(20, '08:40'), {
    lote: 'GAS-2510',
    vence: venceEn(150),
    ref: fact,
  });
  entrada('alcohol', 30, hace(20, '08:45'), { ref: fact });
  entrada('tiras', 8, hace(20, '08:50'), {
    lote: 'TIR-2604',
    vence: venceEn(18),
    ref: 'Fact. B0100000452 · Laboratorios Unidos',
  });
  entrada('paracetamol', 20, hace(20, '08:55'), {
    lote: 'PAR-2503',
    vence: venceEn(-5),
    ref: 'Fact. B0100000453 · Farmacéutica del Este',
  });
  entrada('mascarillas', 30, hace(20, '09:00'), { ref: fact });
  entrada('salina', 60, hace(20, '09:05'), {
    lote: 'SAL-2607',
    vence: venceEn(240),
    ref: 'Fact. B0100000453 · Farmacéutica del Este',
  });
  entrada('cinta', 25, hace(20, '09:10'), { ref: fact });
  entrada('cateter', 100, hace(20, '09:15'), {
    lote: 'CAT-2609',
    vence: venceEn(300),
    ref: fact,
  });

  equipo(
    'nebulizador',
    'ASIGNACION',
    EstadoEquipo.ASIGNADO,
    hace(18, '10:00'),
    `Asignado a ${medicos.PED.nombre} para la consulta pediátrica`,
    medicos.PED,
    hace(11, '17:00'),
  );
  salida('guantes', 12, hace(15, '16:00'), 'Reposición de consultorios');
  salida(
    'mascarillas',
    22,
    hace(15, '16:10'),
    'Reposición de consultorios y sala de espera',
  );
  entrada('paracetamol', 40, hace(12, '09:00'), {
    lote: 'PAR-2611',
    vence: venceEn(300),
    ref: 'Fact. B0100000470 · Farmacéutica del Este',
  });
  equipo(
    'nebulizador',
    'DEVOLUCION',
    EstadoEquipo.DISPONIBLE,
    hace(11, '16:30'),
    'Devuelto en buen estado',
  );
  salida(
    'cateter',
    65,
    hace(10, '11:00'),
    'Jornada de vacunación e hidratación',
  );
  ajuste(
    'jeringas',
    -1,
    10,
    hace(9, '15:00'),
    'Conteo físico: 10 jeringas con empaque dañado',
    'JER-2601',
  );
  salida(
    'paracetamol',
    14,
    hace(9, '15:30'),
    'Dispensación a pacientes de la jornada',
  );

  // Consumos ligados a citas ATENDIDAS (seed de la Épica 2)
  const atendidas = await prisma.cita.findMany({
    where: { centroId: centros.centro.id, estado: EstadoCita.ATENDIDA },
    orderBy: { fechaHora: 'asc' },
    include: { medico: { select: { especialidad: true } } },
  });
  const consumos: Record<string, [string, number][]> = {
    'Medicina General': [
      ['guantes', 1],
      ['gasas', 2],
      ['paracetamol', 2],
    ],
    Cardiología: [
      ['gasas', 2],
      ['alcohol', 1],
    ],
    Pediatría: [
      ['jeringas', 2],
      ['alcohol', 1],
      ['gasas', 1],
    ],
  };
  for (const c of atendidas) {
    const fecha = new Date(c.fechaHora.getTime() + 40 * 60_000);
    if (fecha > new Date()) continue;
    for (const [clave, cant] of consumos[c.medico.especialidad] ?? []) {
      salida(clave, cant, fecha, `Consumo en la cita ${c.codigo}`, c.id);
    }
  }

  equipo(
    'ecg',
    'ASIGNACION',
    EstadoEquipo.ASIGNADO,
    hace(6, '09:30'),
    `Asignado a ${medicos.CARD.nombre} para pruebas de esfuerzo`,
    medicos.CARD,
    instanteRd(sumarDias(hoy, 5), horaAMinutos('17:00')),
  );
  salida('alcohol', 6, hace(4, '10:00'), 'Reposición de consultorios');
  equipo(
    'tensiometro',
    'AJUSTE',
    EstadoEquipo.MANTENIMIENTO,
    hace(3, '11:00'),
    'Calibración anual: las lecturas salían desfasadas',
  );
  ajuste(
    'guantes',
    1,
    2,
    hace(2, '17:30'),
    'Conteo físico: 2 cajas sin registrar',
  );
  salida('gasas', 30, hace(1, '12:00'), 'Curaciones de la semana');
  salida('tiras', 1, hace(1, '12:15'), 'Control de glucosa en consulta');

  // ─── Clínica Santo Domingo (2.º centro) ───────────────────────────
  const fact2 = 'Fact. B0100000390 · Dermalab';
  entrada('c2-guantes', 12, hace(14, '09:00'), { ref: fact2 });
  entrada('c2-crema', 18, hace(14, '09:05'), {
    lote: 'CRM-2701',
    vence: venceEn(120),
    ref: fact2,
  });
  entrada('c2-hisopos', 40, hace(14, '09:10'), { ref: fact2 });
  salida('c2-hisopos', 8, hace(5, '15:00'), 'Procedimientos dermatológicos');

  eventos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  for (const e of eventos) await e.run();

  // Estado final de recursos y lotes
  for (const s of Object.values(estado)) {
    await prisma.recurso.update({
      where: { id: s.id },
      data: {
        stockActual: s.def.tipo === INSUMO ? s.stock : null,
        estadoEquipo: s.estadoEquipo,
        medicoAsignadoId: s.medicoAsignadoId,
        devolucionPrevista: s.devolucionPrevista,
      },
    });
    for (const l of s.lotes) {
      await prisma.lote.update({
        where: { id: l.id },
        data: { cantidadDisponible: l.cantidad },
      });
    }
  }
  console.log(
    `  ✔ INVENTARIO    ${Object.keys(estado).length} recursos y ${total} movimientos (${atendidas.length} citas atendidas con consumo)`,
  );
}
