// Misma regla que el backend (frontend/server/src/utils/recovery.js,
// USERNAME_RE) — deben coincidir exacto.
const USERNAME_RE = /^(?=.{3,30}$)[a-z0-9](?:[a-z0-9_]|[.-](?![.-]))*[a-z0-9_]$/;

export const USERNAME_HINT = "De 3 a 30 caracteres: letras sin tilde, números, punto, guion o guion bajo.";

/** Mensaje de error, o null si el usuario es válido. */
export function usernameError(value) {
  const v = String(value || "").trim().toLowerCase();
  if (USERNAME_RE.test(v)) return null;
  if (v.length < 3 || v.length > 30) return "El usuario debe tener de 3 a 30 caracteres.";
  if (/\s/.test(v)) return "El usuario no puede tener espacios.";
  if (/[^a-z0-9._-]/.test(v)) return "Usá solo letras sin tilde, números, punto, guion o guion bajo.";
  return "El usuario debe empezar con letra o número, sin terminar en punto o guion ni repetirlos seguidos.";
}
