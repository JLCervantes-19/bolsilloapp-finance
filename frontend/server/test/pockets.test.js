import { test } from "node:test";
import assert from "node:assert/strict";
import { consolidate, pocketMetrics } from "../src/services/pockets.service.js";
import { transferSchema, pocketSchema, pocketUpdateSchema } from "../src/validators/index.js";

// Escenario: personal (ingreso 1.000.000, gasto 300.000, aporta 200.000 al negocio
// y recibe un retiro de 100.000); negocio (saldo inicial 50.000, ventas 500.000,
// egresos 150.000, recibe el aporte y entrega el retiro).
const personal = { id: "p", kind: "personal", is_default: true, initial_balance: "0", currency: "COP", name: "Personal" };
const negocio = { id: "n", kind: "business", is_default: false, initial_balance: "50000", currency: "COP", name: "Teléfonos" };

const rowP = {
  saldo: "600000", ingresos_total: "1000000", gastos_total: "300000",
  entradas_total: "100000", salidas_total: "200000", aportes_total: "0", retiros_total: "0", apartado: "0",
  ingresos_periodo: "1000000", gastos_periodo: "300000", entradas_periodo: "100000", salidas_periodo: "200000",
  aportes_periodo: "0", retiros_periodo: "0",
};
const rowN = {
  saldo: "500000", ingresos_total: "500000", gastos_total: "150000",
  entradas_total: "200000", salidas_total: "100000", aportes_total: "200000", retiros_total: "100000", apartado: "0",
  ingresos_periodo: "500000", gastos_periodo: "150000", entradas_periodo: "200000", salidas_periodo: "100000",
  aportes_periodo: "200000", retiros_periodo: "100000",
};

test("métricas de negocio: utilidad sin aportes ni retiros, capital = inicial + aportes", () => {
  const m = pocketMetrics(negocio, rowN);
  assert.equal(m.saldo, 500000);
  assert.equal(m.negocio.utilidadPeriodo, 350000);
  assert.equal(m.negocio.utilidadAcumulada, 350000);
  assert.equal(m.negocio.capitalInvertido, 250000);
  assert.equal(m.negocio.retirosAcumulados, 100000);
  assert.equal(m.negocio.rentabilidadPct, 140);
});

test("bolsillo personal no trae bloque de negocio", () => {
  assert.equal(pocketMetrics(personal, rowP).negocio, undefined);
});

test("consolidado: las transferencias internas no cuentan como ingreso ni gasto", () => {
  const pockets = [personal, negocio].map((p, i) => ({ ...p, metrics: pocketMetrics(p, [rowP, rowN][i]) }));
  const c = consolidate(pockets);
  assert.equal(c.ingresosPeriodo, 1500000); // 1.000.000 + 500.000, sin el retiro de 100.000
  assert.equal(c.gastosPeriodo, 450000); // 300.000 + 150.000, sin el aporte de 200.000
  assert.equal(c.balancePeriodo, 1050000);
  assert.equal(c.patrimonio, 1100000); // Σ saldos
  assert.equal(c.monedasMezcladas, false);
});

test("bolsillo sin movimientos: saldo = saldo inicial", () => {
  assert.equal(pocketMetrics(negocio, undefined).saldo, 50000);
});

test("transferencias: no a sí mismo, extremos obligatorios según el tipo", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const otro = "22222222-2222-4222-8222-222222222222";
  assert.equal(transferSchema.safeParse({ kind: "traslado", from_bolsillo_id: id, to_bolsillo_id: id, amount: 10 }).success, false);
  assert.equal(transferSchema.safeParse({ kind: "traslado", from_bolsillo_id: id, amount: 10 }).success, false);
  assert.equal(transferSchema.safeParse({ kind: "aporte", amount: 10 }).success, false);
  assert.equal(transferSchema.safeParse({ kind: "retiro", from_bolsillo_id: id, amount: 10 }).success, true);
  assert.equal(transferSchema.safeParse({ kind: "aporte", to_bolsillo_id: id, amount: -5 }).success, false);
  assert.equal(transferSchema.safeParse({ kind: "traslado", from_bolsillo_id: id, to_bolsillo_id: otro, amount: 10 }).success, true);
});

test("bolsillos: nombre obligatorio, color hex, el tipo no se edita", () => {
  assert.equal(pocketSchema.safeParse({ name: "  ", kind: "business" }).success, false);
  assert.equal(pocketSchema.safeParse({ name: "Joyería", kind: "business", color: "red" }).success, false);
  assert.equal(pocketSchema.safeParse({ name: "Joyería", kind: "business", color: "#aa00cc", initial_balance: 0 }).success, true);
  assert.equal("kind" in pocketUpdateSchema.parse({ kind: "personal", name: "x" }), false);
});
