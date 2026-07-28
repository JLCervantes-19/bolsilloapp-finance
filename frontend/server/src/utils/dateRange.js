function pad(n) {
  return String(n).padStart(2, "0");
}
function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function currentMonthRange(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

export function previousMonthRange(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const end = new Date(reference.getFullYear(), reference.getMonth(), 0);
  return { start: toISODate(start), end: toISODate(end) };
}

/** Últimos `count` meses (incluyendo el actual), más viejo primero. */
export function lastMonthsRanges(count, reference = new Date()) {
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
