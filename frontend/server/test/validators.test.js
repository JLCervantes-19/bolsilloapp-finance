import { test } from "node:test";
import assert from "node:assert/strict";
import { expenseSchema, quickIncomeSchema, goalSchema, dateRangeQuerySchema, debtStrategyQuerySchema, analyticsQuerySchema } from "../src/validators/index.js";

const UUID = "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b";

test("gasto válido pasa y descarta user_id ajeno", () => {
  const r = expenseSchema.safeParse({ category_id: UUID, amount: 1000, user_id: "otro" });
  assert.equal(r.success, true);
  assert.equal("user_id" in r.data, false);
});

test("monto negativo o cero falla", () => {
  assert.equal(expenseSchema.safeParse({ amount: 0 }).success, false);
  assert.equal(expenseSchema.safeParse({ amount: -5 }).success, false);
});

test("más de 20 tags falla", () => {
  assert.equal(expenseSchema.safeParse({ amount: 1, tags: Array(21).fill("x") }).success, false);
});

test("porcentajes de asignación entre 0 y 100", () => {
  assert.equal(quickIncomeSchema.safeParse({ category_id: UUID, amount: 1, allocate_investment_pct: 101 }).success, false);
});

test("meta con fecha mal formada falla", () => {
  assert.equal(goalSchema.safeParse({ name: "x", target_amount: 1, target_date: "13/11/2026" }).success, false);
});

test("query de rango y pago extra", () => {
  assert.equal(dateRangeQuerySchema.safeParse({ start: "x" }).success, false);
  assert.equal(debtStrategyQuerySchema.parse({ extraPayment: "200000" }).extraPayment, 200000);
  assert.equal(debtStrategyQuerySchema.parse({}).extraPayment, 0);
});

test("months de analítica: 1 a 24, 6 por defecto", () => {
  assert.equal(analyticsQuerySchema.parse({}).months, 6);
  assert.equal(analyticsQuerySchema.parse({ months: "12" }).months, 12);
  assert.equal(analyticsQuerySchema.safeParse({ months: "5000" }).success, false);
  assert.equal(analyticsQuerySchema.safeParse({ months: "0" }).success, false);
});
