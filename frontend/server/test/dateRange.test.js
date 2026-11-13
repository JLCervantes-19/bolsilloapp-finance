import { test } from "node:test";
import assert from "node:assert/strict";
import { todayISO, currentMonthRange, previousMonthRange, lastMonthsRanges } from "../src/utils/dateRange.js";

test("todayISO usa la fecha de Bogotá, no la UTC", () => {
  // 1 dic 03:00 UTC = 30 nov 22:00 en Bogotá
  assert.equal(todayISO(new Date("2026-12-01T03:00:00Z")), "2026-11-30");
  // 1 dic 05:00 UTC = 1 dic 00:00 en Bogotá
  assert.equal(todayISO(new Date("2026-12-01T05:00:00Z")), "2026-12-01");
});

test("currentMonthRange cubre el mes completo", () => {
  assert.deepEqual(currentMonthRange(new Date(2026, 1, 15)), { start: "2026-02-01", end: "2026-02-28" });
});

test("previousMonthRange cruza el año", () => {
  assert.deepEqual(previousMonthRange(new Date(2026, 0, 10)), { start: "2025-12-01", end: "2025-12-31" });
});

test("lastMonthsRanges devuelve N meses, el más viejo primero", () => {
  const r = lastMonthsRanges(3, new Date(2026, 0, 10));
  assert.deepEqual(r.map((x) => x.start), ["2025-11-01", "2025-12-01", "2026-01-01"]);
});
