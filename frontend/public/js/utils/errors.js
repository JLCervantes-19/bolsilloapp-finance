/**
 * Mensaje a mostrar para una respuesta de error de la API. Ante un error de
 * validación ("Datos inválidos") prefiere el primer motivo concreto de zod
 * (p. ej. las reglas del usuario), que es lo que la persona puede corregir.
 */
export function apiErrorMessage(json, fallback) {
  const details = json?.error?.details;
  const first = details && typeof details === "object" ? Object.values(details).flat().find((m) => typeof m === "string") : null;
  return first || json?.error?.message || fallback;
}
