const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'INTERNAL_API_KEY'] as const;

/** Valores de ejemplo de .env.example: nunca deben llegar a producción. */
const VALORES_DE_EJEMPLO = [
  'cambia-este-secreto-por-uno-largo-y-aleatorio',
  'cambia-esta-clave-interna',
];

/** Falla al arrancar si falta alguna variable imprescindible. */
export function validateEnv(env: Record<string, unknown>) {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(
      `Faltan variables de entorno: ${missing.join(', ')}. Copia .env.example a .env en la raíz del proyecto (en Render, agrégalas en Environment).`,
    );
  }
  if (String(env.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  }
  if (env.NODE_ENV === 'production') {
    const inseguras = (['JWT_SECRET', 'INTERNAL_API_KEY'] as const).filter(
      (k) => VALORES_DE_EJEMPLO.includes(String(env[k])),
    );
    if (inseguras.length) {
      throw new Error(
        `En producción ${inseguras.join(' y ')} no puede usar el valor de ejemplo. Genera uno aleatorio.`,
      );
    }
    if (!env.WEB_URL) {
      throw new Error(
        'En producción falta WEB_URL (la URL pública de la web, para CORS).',
      );
    }
  }
  return env;
}
