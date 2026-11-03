/** Misma política que valida la API (apps/api/src/common/password-policy.ts). */
export const PASSWORD_RULES = [
  { id: "length", label: "Al menos 10 caracteres", test: (v: string) => v.length >= 10 },
  { id: "upper", label: "Una letra mayúscula", test: (v: string) => /[A-Z]/.test(v) },
  { id: "lower", label: "Una letra minúscula", test: (v: string) => /[a-z]/.test(v) },
  { id: "digit", label: "Un número", test: (v: string) => /\d/.test(v) },
  {
    id: "symbol",
    label: "Un símbolo (por ejemplo ! @ # -)",
    test: (v: string) => /[^A-Za-z0-9]/.test(v),
  },
] as const;

export function isStrongPassword(value: string) {
  return value.length <= 72 && PASSWORD_RULES.every((rule) => rule.test(value));
}
