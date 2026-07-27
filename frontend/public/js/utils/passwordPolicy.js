/**
 * Misma política que el backend (backend/src/routes/auth.routes.js) —
 * deben coincidir exacto para que "cumple todo acá" == "el servidor la acepta".
 */
export const PASSWORD_RULES = [
  { id: "length", label: "Al menos 8 caracteres", test: (v) => v.length >= 8 },
  { id: "lower", label: "Una letra minúscula", test: (v) => /[a-z]/.test(v) },
  { id: "upper", label: "Una letra mayúscula", test: (v) => /[A-Z]/.test(v) },
  { id: "number", label: "Un número", test: (v) => /[0-9]/.test(v) },
];

export function passwordMeetsPolicy(value) {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}
