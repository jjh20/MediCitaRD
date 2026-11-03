import { isStrongPassword } from './password-policy';

describe('Política de contraseñas', () => {
  it.each(['Admin1234!', 'Demo12345!', 'Abcdefgh1$'])(
    'acepta una contraseña fuerte: %s',
    (password) => expect(isStrongPassword(password)).toBe(true),
  );

  it.each([
    ['muy corta', 'Ab1$abc'],
    ['sin mayúscula', 'abcdefgh1$x'],
    ['sin minúscula', 'ABCDEFGH1$X'],
    ['sin dígito', 'Abcdefghij$'],
    ['sin símbolo', 'Abcdefghij1'],
  ])('rechaza una contraseña %s', (_caso, password) =>
    expect(isStrongPassword(password)).toBe(false),
  );
});
