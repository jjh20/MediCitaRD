/**
 * Seed de MediCita RD.
 *
 * - Crea (o restablece) el administrador inicial desde BOOTSTRAP_ADMIN_EMAIL
 *   y BOOTSTRAP_ADMIN_PASSWORD.
 * - Si SEED_DEMO_USERS=true, crea (o restablece) las cuentas de demostración
 *   con DEMO_USERS_PASSWORD: 3 pacientes y 2 centros médicos.
 * - Épica 2: médicos de los centros de demo y citas repartidas en las
 *   últimas 2 semanas y las próximas 2, con todos los estados e historial.
 *
 * Es idempotente: volver a ejecutarlo deja las cuentas sembradas con su rol
 * original, activas y con la contraseña configurada, restablece los médicos
 * de demo y vuelve a generar sus citas con fechas relativas a hoy (útil
 * entre demos).
 */
import {
  AccionCita,
  EstadoCita,
  Prisma,
  PrismaClient,
  Role,
  TipoCita,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  BCRYPT_ROUNDS,
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from '../src/common/password-policy';
import {
  horaAMinutos,
  instanteRd,
  partesRd,
  sumarDias,
} from '../src/common/rd-time';

const prisma = new PrismaClient();

interface SeedAccount {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}

async function upsertAccount(account: SeedAccount): Promise<User> {
  if (!isStrongPassword(account.password)) {
    throw new Error(
      `Contraseña inválida para ${account.email}: ${PASSWORD_POLICY_MESSAGE}`,
    );
  }
  const email = account.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(account.password, BCRYPT_ROUNDS);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName: account.fullName,
      passwordHash,
      role: account.role,
      isActive: true,
    },
    update: { passwordHash, role: account.role, isActive: true },
  });
  console.log(`  ✔ ${user.role.padEnd(13)} ${user.email}`);
  return user;
}

// ─── Épica 2: médicos y citas de demo ────────────────────────────────

const LUNES_A_VIERNES = [1, 2, 3, 4, 5];

interface SeedMedico {
  clave: string;
  nombre: string;
  especialidad: string;
  precioConsulta: number;
}

const MEDICOS_CENTRO_1: SeedMedico[] = [
  {
    clave: 'MG',
    nombre: 'Dra. Laura Fernández',
    especialidad: 'Medicina General',
    precioConsulta: 1500,
  },
  {
    clave: 'CARD',
    nombre: 'Dr. Ricardo Gómez',
    especialidad: 'Cardiología',
    precioConsulta: 2500,
  },
  {
    clave: 'PED',
    nombre: 'Dra. Patricia Núñez',
    especialidad: 'Pediatría',
    precioConsulta: 1800,
  },
];

const MEDICOS_CENTRO_2: SeedMedico[] = [
  {
    clave: 'DERM',
    nombre: 'Dr. Miguel Santana',
    especialidad: 'Dermatología',
    precioConsulta: 2000,
  },
];

/** Crea o restablece un médico de demo (horario L-V 8:00 a 17:00, 30 min). */
async function upsertMedico(centroId: string, m: SeedMedico) {
  const data = {
    especialidad: m.especialidad,
    precioConsulta: m.precioConsulta,
    duracionMin: 30,
    diasSemana: LUNES_A_VIERNES,
    horaInicio: '08:00',
    horaFin: '17:00',
    activo: true,
  };
  const existente = await prisma.medico.findFirst({
    where: { centroId, nombre: m.nombre },
  });
  const medico = existente
    ? await prisma.medico.update({ where: { id: existente.id }, data })
    : await prisma.medico.create({
        data: { ...data, centroId, nombre: m.nombre },
      });
  console.log(`  ✔ MÉDICO        ${medico.nombre} (${medico.especialidad})`);
  return medico;
}

type Quien = 'p1' | 'p2' | 'p3';

interface SeedCita {
  /** Días respecto a hoy (si cae en fin de semana se mueve a un día hábil) */
  dias: number;
  hora: string;
  medico: string;
  paciente: Quien;
  estado: EstadoCita;
  tipo?: TipoCita;
  motivo: string;
  notas?: string;
  cancelacion?: { por: 'paciente' | 'centro'; motivo: string };
  /** Se agendó primero en otra fecha y luego se reprogramó */
  reprogramadaDesdeDias?: number;
}

const CITAS: SeedCita[] = [
  // ─ Últimas 2 semanas
  {
    dias: -13,
    hora: '08:30',
    medico: 'MG',
    paciente: 'p1',
    estado: 'ATENDIDA',
    motivo: 'Chequeo general anual',
    notas: 'Paciente en buen estado general. Se indican analíticas de rutina.',
  },
  {
    dias: -12,
    hora: '09:00',
    medico: 'CARD',
    paciente: 'p2',
    estado: 'ATENDIDA',
    tipo: 'ESTUDIO',
    motivo: 'Electrocardiograma por dolor en el pecho al hacer ejercicio',
    notas: 'Electrocardiograma normal. Control en 6 meses.',
  },
  {
    dias: -11,
    hora: '10:00',
    medico: 'PED',
    paciente: 'p3',
    estado: 'NO_ASISTIO',
    motivo: 'Control de crecimiento de mi hijo',
  },
  {
    dias: -10,
    hora: '14:00',
    medico: 'MG',
    paciente: 'p2',
    estado: 'CANCELADA',
    motivo: 'Gripe y fiebre',
    cancelacion: {
      por: 'paciente',
      motivo: 'Ya me siento mejor, no necesito la consulta.',
    },
  },
  {
    dias: -8,
    hora: '11:00',
    medico: 'CARD',
    paciente: 'p1',
    estado: 'ATENDIDA',
    motivo: 'Control de presión arterial',
    notas: 'Presión 130/85. Se ajusta la dosis del tratamiento.',
  },
  {
    dias: -7,
    hora: '15:30',
    medico: 'PED',
    paciente: 'p2',
    estado: 'ATENDIDA',
    motivo: 'Vacunación de mi hija',
    notas: 'Se aplicó la vacuna correspondiente a la edad.',
  },
  {
    dias: -6,
    hora: '10:00',
    medico: 'DERM',
    paciente: 'p1',
    estado: 'ATENDIDA',
    motivo: 'Revisión de un lunar',
    notas: 'Lunar benigno. Revisión anual.',
  },
  {
    dias: -5,
    hora: '09:30',
    medico: 'MG',
    paciente: 'p3',
    estado: 'ATENDIDA',
    motivo: 'Dolor de cabeza frecuente',
    notas: 'Cefalea tensional. Se recomiendan pausas activas e hidratación.',
  },
  {
    dias: -4,
    hora: '16:00',
    medico: 'CARD',
    paciente: 'p3',
    estado: 'NO_ASISTIO',
    tipo: 'ESTUDIO',
    motivo: 'Ecocardiograma',
  },
  {
    dias: -2,
    hora: '10:30',
    medico: 'MG',
    paciente: 'p1',
    estado: 'CONFIRMADA',
    motivo: 'Revisión de resultados de laboratorio',
  },
  {
    dias: -1,
    hora: '11:30',
    medico: 'PED',
    paciente: 'p2',
    estado: 'CONFIRMADA',
    motivo: 'Revisión de alergia en la piel',
  },
  // ─ Próximas 2 semanas
  {
    dias: 1,
    hora: '09:00',
    medico: 'MG',
    paciente: 'p1',
    estado: 'PENDIENTE',
    motivo: 'Dolor de espalda',
  },
  {
    dias: 2,
    hora: '10:00',
    medico: 'CARD',
    paciente: 'p1',
    estado: 'CONFIRMADA',
    motivo: 'Seguimiento cardiológico',
  },
  {
    dias: 3,
    hora: '08:30',
    medico: 'PED',
    paciente: 'p2',
    estado: 'PENDIENTE',
    motivo: 'Fiebre persistente de mi hijo',
  },
  {
    dias: 4,
    hora: '10:00',
    medico: 'DERM',
    paciente: 'p2',
    estado: 'PENDIENTE',
    motivo: 'Tratamiento para el acné',
  },
  {
    dias: 5,
    hora: '14:30',
    medico: 'MG',
    paciente: 'p3',
    estado: 'CANCELADA',
    motivo: 'Chequeo de rutina',
    cancelacion: {
      por: 'centro',
      motivo: 'La doctora no estará disponible ese día por un congreso.',
    },
  },
  {
    dias: 6,
    hora: '11:00',
    medico: 'DERM',
    paciente: 'p3',
    estado: 'CONFIRMADA',
    motivo: 'Manchas en la piel',
  },
  {
    dias: 8,
    hora: '15:00',
    medico: 'CARD',
    paciente: 'p2',
    estado: 'PENDIENTE',
    tipo: 'ESTUDIO',
    motivo: 'Prueba de esfuerzo',
  },
  {
    dias: 10,
    hora: '11:00',
    medico: 'PED',
    paciente: 'p3',
    estado: 'CONFIRMADA',
    motivo: 'Chequeo pediátrico',
  },
  {
    dias: 12,
    hora: '09:30',
    medico: 'MG',
    paciente: 'p1',
    estado: 'PENDIENTE',
    motivo: 'Certificado médico para el trabajo',
    reprogramadaDesdeDias: 7,
  },
];

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;

/** Fecha hábil (lunes a viernes) a `dias` de hoy, en hora de RD. */
function fechaHabil(dias: number): string {
  let fecha = sumarDias(partesRd(new Date()).fecha, dias);
  const paso = dias < 0 ? -1 : 1;
  while (partesRd(instanteRd(fecha, 12 * 60)).diaSemana > 5) {
    fecha = sumarDias(fecha, paso);
  }
  return fecha;
}

const antes = (a: Date, b: Date) => (a < b ? a : b);

async function seedCitas(
  pacientes: Record<Quien, User>,
  centros: User[],
  medicos: Record<
    string,
    {
      id: string;
      centroId: string;
      precioConsulta: Prisma.Decimal;
      nombre: string;
    }
  >,
) {
  // Restablece: borra las citas de los médicos de demo (y su historial)
  const ids = Object.values(medicos).map((m) => m.id);
  const borradas = await prisma.cita.deleteMany({
    where: { medicoId: { in: ids } },
  });
  if (borradas.count) {
    console.log(`  ↺ ${borradas.count} citas de demo anteriores eliminadas`);
  }
  // Si no quedan otras citas, los códigos vuelven a empezar en CIT-0001
  if ((await prisma.cita.count()) === 0) {
    await prisma.$executeRawUnsafe(
      'ALTER SEQUENCE "Cita_codigo_seq" RESTART WITH 1',
    );
  }

  const ahora = new Date();
  const plan = CITAS.map((c) => ({
    ...c,
    fechaHora: instanteRd(fechaHabil(c.dias), horaAMinutos(c.hora)),
  })).sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime());

  for (const c of plan) {
    const medico = medicos[c.medico];
    const paciente = pacientes[c.paciente];
    const centroId = medico.centroId;
    if (!centros.some((x) => x.id === centroId)) continue;

    // Momentos del historial, siempre en el pasado y en orden
    const creada = antes(
      new Date(c.fechaHora.getTime() - 4 * DIA_MS),
      new Date(ahora.getTime() - 3 * DIA_MS),
    );
    const t = (horas: number) => new Date(creada.getTime() + horas * HORA_MS);
    const cierre = new Date(c.fechaHora.getTime() + HORA_MS);

    const historial: Prisma.CitaHistorialCreateWithoutCitaInput[] = [];
    const add = (
      accion: AccionCita,
      usuario: User,
      createdAt: Date,
      extra: Partial<Prisma.CitaHistorialCreateWithoutCitaInput> = {},
    ) =>
      historial.push({
        accion,
        usuario: { connect: { id: usuario.id } },
        createdAt,
        ...extra,
      });
    const centro = centros.find((x) => x.id === centroId)!;

    if (c.reprogramadaDesdeDias !== undefined) {
      const original = instanteRd(
        fechaHabil(c.reprogramadaDesdeDias),
        horaAMinutos(c.hora),
      );
      add(AccionCita.CREADA, paciente, t(0), {
        estadoNuevo: 'PENDIENTE',
        comentario: `Cita agendada con ${medico.nombre}.`,
      });
      add(AccionCita.CONFIRMADA, centro, t(5), {
        estadoAnterior: 'PENDIENTE',
        estadoNuevo: 'CONFIRMADA',
      });
      add(AccionCita.REPROGRAMADA, paciente, t(30), {
        estadoAnterior: 'CONFIRMADA',
        estadoNuevo: 'PENDIENTE',
        cambios: {
          fechaHora: {
            antes: original.toISOString(),
            despues: c.fechaHora.toISOString(),
          },
        },
        comentario: 'Tengo un compromiso de trabajo ese día.',
      });
    } else {
      add(AccionCita.CREADA, paciente, t(0), {
        estadoNuevo: 'PENDIENTE',
        comentario: `Cita agendada con ${medico.nombre}.`,
      });
      const confirma = ['CONFIRMADA', 'ATENDIDA', 'NO_ASISTIO'].includes(
        c.estado,
      );
      if (confirma) {
        add(AccionCita.CONFIRMADA, centro, t(6), {
          estadoAnterior: 'PENDIENTE',
          estadoNuevo: 'CONFIRMADA',
        });
      }
      if (c.estado === 'ATENDIDA' || c.estado === 'NO_ASISTIO') {
        add(AccionCita.CERRADA, centro, cierre, {
          estadoAnterior: 'CONFIRMADA',
          estadoNuevo: c.estado,
          cambios: c.notas
            ? { notasCierre: { antes: null, despues: c.notas } }
            : undefined,
          comentario: c.notas ?? null,
        });
      }
      if (c.estado === 'CANCELADA' && c.cancelacion) {
        add(
          AccionCita.CANCELADA,
          c.cancelacion.por === 'paciente' ? paciente : centro,
          t(20),
          {
            estadoAnterior: 'PENDIENTE',
            estadoNuevo: 'CANCELADA',
            cambios: {
              motivoCancelacion: { antes: null, despues: c.cancelacion.motivo },
            },
            comentario: c.cancelacion.motivo,
          },
        );
      }
    }

    const cita = await prisma.cita.create({
      data: {
        pacienteId: paciente.id,
        medicoId: medico.id,
        centroId,
        fechaHora: c.fechaHora,
        tipo: c.tipo ?? 'CONSULTA',
        motivo: c.motivo,
        estado: c.estado,
        costo: medico.precioConsulta,
        notasCierre: c.notas ?? null,
        motivoCancelacion: c.cancelacion?.motivo ?? null,
        createdAt: creada,
        historial: { create: historial },
      },
    });
    console.log(
      `  ✔ CITA          ${cita.codigo} ${c.estado.padEnd(10)} ${partesRd(c.fechaHora).fecha} ${c.hora} ${medico.nombre} · ${paciente.email}`,
    );
  }
}

async function main() {
  console.log('Sembrando datos de MediCita RD...');

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    await upsertAccount({
      email: adminEmail,
      password: adminPassword,
      fullName: 'Administrador MediCita',
      role: Role.ADMIN,
    });
  } else {
    console.warn(
      '  ⚠ BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD no definidos: no se crea administrador.',
    );
  }

  if (process.env.SEED_DEMO_USERS === 'true') {
    const demoPassword = process.env.DEMO_USERS_PASSWORD;
    if (!demoPassword) {
      throw new Error('SEED_DEMO_USERS=true requiere DEMO_USERS_PASSWORD.');
    }
    const demo = (email: string, fullName: string, role: Role) =>
      upsertAccount({ email, password: demoPassword, fullName, role });

    const p1 = await demo(
      'paciente@medicita.local',
      'María Pérez (demo)',
      Role.PACIENTE,
    );
    const centro = await demo(
      'centro@medicita.local',
      'Centro Médico Esperanza (demo)',
      Role.CENTRO_MEDICO,
    );
    const p2 = await demo(
      'paciente2@medicita.local',
      'Juan Rodríguez (demo)',
      Role.PACIENTE,
    );
    const p3 = await demo(
      'paciente3@medicita.local',
      'Ana Martínez (demo)',
      Role.PACIENTE,
    );
    const centro2 = await demo(
      'centro2@medicita.local',
      'Clínica Santo Domingo (demo)',
      Role.CENTRO_MEDICO,
    );

    const medicos: Record<
      string,
      Awaited<ReturnType<typeof upsertMedico>>
    > = {};
    for (const m of MEDICOS_CENTRO_1)
      medicos[m.clave] = await upsertMedico(centro.id, m);
    for (const m of MEDICOS_CENTRO_2)
      medicos[m.clave] = await upsertMedico(centro2.id, m);

    await seedCitas({ p1, p2, p3 }, [centro, centro2], medicos);
  }

  console.log('Seed completado.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
