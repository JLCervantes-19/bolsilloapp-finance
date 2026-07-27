const MONTH_ABBREV = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fmt(amount) {
  return "$" + Math.round(Number(amount) || 0).toLocaleString("es-CO");
}

export function fmtSigned(amount) {
  const n = Number(amount) || 0;
  return (n < 0 ? "-" : "+") + fmt(Math.abs(n));
}

export function fmtDateShort(isoDate) {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTH_ABBREV[month - 1]}`;
}

export function fmtPct(n, digits = 0) {
  return `${Number(n).toFixed(digits)}%`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
