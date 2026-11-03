/**
 * Seed de MediCita RD.
 *
 * - Crea (o restablece) el administrador inicial desde BOOTSTRAP_ADMIN_EMAIL
 *   y BOOTSTRAP_ADMIN_PASSWORD.
 * - Si SEED_DEMO_USERS=true, crea (o restablece) un paciente y un centro
 *   médico de demostración con DEMO_USERS_PASSWORD.
 *
 * Es idempotente: volver a ejecutarlo deja las cuentas sembradas con su rol
 * original, activas y con la contraseña configurada (útil entre demos).
 */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  BCRYPT_ROUNDS,
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from '../src/common/password-policy';

const prisma = new PrismaClient();

interface SeedAccount {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}

async function upsertAccount(account: SeedAccount) {
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
    await upsertAccount({
      email: 'paciente@medicita.local',
      password: demoPassword,
      fullName: 'María Pérez (demo)',
      role: Role.PACIENTE,
    });
    await upsertAccount({
      email: 'centro@medicita.local',
      password: demoPassword,
      fullName: 'Centro Médico Esperanza (demo)',
      role: Role.CENTRO_MEDICO,
    });
  }

  console.log('Seed completado.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
