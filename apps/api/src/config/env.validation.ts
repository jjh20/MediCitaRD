const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'INTERNAL_API_KEY'] as const;

/** Falla al arrancar si falta alguna variable imprescindible. */
export function validateEnv(env: Record<string, unknown>) {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(
      `Faltan variables de entorno: ${missing.join(', ')}. Copia .env.example a .env en la raíz del proyecto.`,
    );
  }
  if (String(env.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  }
  return env;
}
