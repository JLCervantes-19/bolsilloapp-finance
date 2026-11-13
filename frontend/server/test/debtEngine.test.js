import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/services/engines/debtEngine.js";

test("deuda sin interés se paga en balance/mínimo meses", () => {
  const r = simulate([{ id: "a", name: "A", balance: 100000, rate: 0, minPayment: 10000 }], "avalanche", 0);
  assert.equal(r.months, 10);
  assert.equal(r.paysOff, true);
  assert.equal(r.order[0].paidMonth, 10);
});

test("mínimo menor que el interés → paysOff false y paidMonth null", () => {
  // 36% anual sobre 1.000.000 = 30.000/mes de interés; mínimo 20.000
  const r = simulate([{ id: "a", name: "A", balance: 1000000, rate: 36, minPayment: 20000 }], "avalanche", 0);
  assert.equal(r.paysOff, false);
  assert.equal(r.order[0].paidMonth, null);
});

test("sin deudas → 0 meses", () => {
  const r = simulate([], "snowball", 0);
  assert.equal(r.months, 0);
  assert.equal(r.paysOff, true);
});

test("deuda activa ya en 0 se considera pagada (mes 0), no 'sin fin'", () => {
  const r = simulate(
    [
      { id: "a", name: "A", balance: 0, rate: 20, minPayment: 0 },
      { id: "b", name: "B", balance: 50000, rate: 0, minPayment: 10000 },
    ],
    "snowball",
    0
  );
  assert.equal(r.paysOff, true);
  assert.equal(r.order.find((o) => o.id === "a").paidMonth, 0);
  assert.equal(r.order.find((o) => o.id === "b").paidMonth, 5);
});
