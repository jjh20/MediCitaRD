/**
 * Prepara las variables de entorno de las pruebas e2e.
 * Lee el .env de la raíz (o .env.example si no existe) y apunta DATABASE_URL
 * a la base de pruebas. Se niega a continuar si no es una base de pruebas,
 * para no borrar nunca los datos de desarrollo.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadTestEnv() {
  const root = path.resolve(__dirname, '../../..');
  for (const file of ['.env', '.env.example']) {
    const full = path.join(root, file);
    if (fs.existsSync(full)) dotenv.config({ path: full, quiet: true });
  }

  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) {
    throw new Error('Falta DATABASE_URL_TEST para las pruebas e2e.');
  }
  const dbName = new URL(testUrl).pathname.replace('/', '');
  if (!/test/i.test(dbName)) {
    throw new Error(
      `DATABASE_URL_TEST debe apuntar a una base de pruebas (recibido: "${dbName}").`,
    );
  }

  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = 'test';
  process.env.JWT_EXPIRES_IN = '8h';
  return testUrl;
}

module.exports = { loadTestEnv };
