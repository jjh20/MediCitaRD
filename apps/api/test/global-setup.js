const { execSync } = require('child_process');
const path = require('path');
const { loadTestEnv } = require('./test-env');

/** Aplica las migraciones a la base de pruebas antes de correr los e2e. */
module.exports = async () => {
  const url = loadTestEnv();
  try {
    execSync('npx prisma migrate deploy', {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    throw new Error(
      `No se pudo preparar la base de pruebas. ¿Está PostgreSQL corriendo? (npm run db:up)\n${output}`,
    );
  }
};
