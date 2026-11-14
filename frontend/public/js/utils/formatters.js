const MONTH_ABBREV = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fmt(amount) {
  return "$" + Math.round(Number(amount) || 0).toLocaleString("es-CO");
}

/** Monto con su moneda: COP como siempre ("$1.000"); otras monedas llevan el código. */
export function fmtMoney(amount, currency = "COP") {
  return currency && currency !== "COP" ? `${fmt(amount)} ${currency}` : fmt(amount);
}

/** Eje de gráficos: compacto y sin decimales sobrantes ($0, $850, $12k, $1,5M). */
export function fmtAxis(value) {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const trim = (n) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3)}k`;
  return `${sign}$${Math.round(abs)}`;
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

// Fecha local del dispositivo (no UTC): toISOString() adelantaba el día
// después de las 7 p. m. en Colombia.
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function firstName(fullName) {
  return fullName?.trim().split(/\s+/)[0] || "";
}
