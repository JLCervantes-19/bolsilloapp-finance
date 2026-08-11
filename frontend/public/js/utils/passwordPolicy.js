/**
 * Misma política que el backend (frontend/server/src/routes/auth.routes.js)
 * — deben coincidir exacto para que "cumple acá" == "el servidor la acepta".
 * 6 caracteres es el mínimo que Supabase Auth exige internamente.
 */
export const PASSWORD_RULES = [{ id: "length", label: "Al menos 6 caracteres", test: (v) => v.length >= 6 }];

export function passwordMeetsPolicy(value) {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}
