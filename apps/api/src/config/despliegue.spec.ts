import { origenesCors, trustProxy } from '../setup';
import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://u:p@host/db',
  JWT_SECRET: 'x'.repeat(48),
  INTERNAL_API_KEY: 'clave-interna-larga',
};

describe('Configuración de despliegue', () => {
  it('TU-51 en producción rechaza los secretos de ejemplo y exige WEB_URL', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        WEB_URL: 'https://medicita.vercel.app',
        JWT_SECRET: 'cambia-este-secreto-por-uno-largo-y-aleatorio',
      }),
    ).toThrow('En producción JWT_SECRET no puede usar el valor de ejemplo.');
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /falta WEB_URL/,
    );
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        WEB_URL: 'https://medicita.vercel.app',
      }),
    ).not.toThrow();
    // En desarrollo y pruebas los valores de ejemplo siguen funcionando
    expect(() =>
      validateEnv({ ...base, INTERNAL_API_KEY: 'cambia-esta-clave-interna' }),
    ).not.toThrow();
  });

  it('TU-52 WEB_URL admite varios orígenes separados por coma (sin / final)', () => {
    expect(origenesCors(undefined)).toEqual(['http://localhost:3000']);
    expect(
      origenesCors(
        ' https://medicita.vercel.app/ ,https://medicita-git-jael.vercel.app',
      ),
    ).toEqual([
      'https://medicita.vercel.app',
      'https://medicita-git-jael.vercel.app',
    ]);
  });

  it('TU-53 TRUST_PROXY: loopback por defecto; true, false o número de saltos', () => {
    expect(trustProxy(undefined)).toBe('loopback');
    expect(trustProxy('true')).toBe(true);
    expect(trustProxy('false')).toBe(false);
    expect(trustProxy('2')).toBe(2);
  });
});
