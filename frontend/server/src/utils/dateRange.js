function pad(n) {
  return String(n).padStart(2, "0");
}
function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const APP_TIME_ZONE = "America/Bogota";

/**
 * "Hoy" según Colombia, sin importar la zona del servidor (Vercel corre en
 * UTC). Devuelve un Date local a medianoche con ese año/mes/día, para que
 * las funciones de abajo puedan seguir usando getFullYear()/getMonth().
 */
export function todayInAppTz(now = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(now = new Date()) {
  return toISODate(todayInAppTz(now));
}

export function currentMonthRange(reference = todayInAppTz()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

export function previousMonthRange(reference = todayInAppTz()) {
  const start = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const end = new Date(reference.getFullYear(), reference.getMonth(), 0);
  return { start: toISODate(start), end: toISODate(end) };
}

/** Últimos `count` meses (incluyendo el actual), más viejo primero. */
export function lastMonthsRanges(count, reference = todayInAppTz()) {
  const ranges = [];
  for (let i = count - 1; i >= 0; i--) {
    const ref = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    ranges.push({
      label: ref.toLocaleDateString("es-CO", { month: "short" }).replace(".", ""),
      start: toISODate(start),
      end: toISODate(end),
    });
  }
  return ranges;
}
