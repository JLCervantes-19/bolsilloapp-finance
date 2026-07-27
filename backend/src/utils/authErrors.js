/**
 * Supabase Auth (GoTrue) devuelve sus mensajes de error siempre en inglés,
 * sin importar el idioma del proyecto — no hay una opción de configuración
 * para eso. Esta tabla traduce los mensajes más comunes; si no reconoce el
 * texto, devuelve un mensaje genérico en español en vez de dejar pasar el
 * inglés crudo al usuario.
 */
const KNOWN_ERRORS = [
  [/user already registered/i, "Ya existe una cuenta con ese correo. Iniciá sesión en vez de registrarte."],
  [/invalid login credentials/i, "Correo o contraseña incorrectos."],
  [/email not confirmed/i, "Todavía no confirmaste tu correo — revisá tu bandeja de entrada."],
  [/password should be at least/i, "La contraseña no cumple con los requisitos mínimos."],
  [/password is known to be weak|easy to guess|pwned/i, "Esa contraseña es muy común o insegura — elegí otra."],
  [/rate limit|too many requests/i, "Demasiados intentos. Esperá un momento y volvé a intentar."],
  [/invalid email/i, "Ese correo no es válido."],
  [/signups? not allowed|disabled/i, "El registro de nuevas cuentas está deshabilitado por ahora."],
  [/refresh token/i, "Tu sesión expiró — iniciá sesión de nuevo."],
  [/network|fetch failed/i, "No se pudo conectar con el servidor. Revisá tu conexión."],
];

export function translateAuthError(message = "") {
  for (const [pattern, spanish] of KNOWN_ERRORS) {
    if (pattern.test(message)) return spanish;
  }
  return "No se pudo completar la operación. Intentá de nuevo en unos segundos.";
}
