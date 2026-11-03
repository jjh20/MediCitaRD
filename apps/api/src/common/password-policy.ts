/**
 * Política de contraseñas de MediCita RD: mínimo 10 caracteres,
 * con al menos una mayúscula, una minúscula, un dígito y un símbolo.
 * bcrypt solo considera los primeros 72 bytes, por eso se limita el máximo.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,72}$/;
export const PASSWORD_POLICY_MESSAGE =
  'La contraseña debe tener al menos 10 caracteres e incluir mayúscula, minúscula, número y símbolo.';

export const BCRYPT_ROUNDS = 12;

export function isStrongPassword(password: string): boolean {
  return PASSWORD_REGEX.test(password);
}
