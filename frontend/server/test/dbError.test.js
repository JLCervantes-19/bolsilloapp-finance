import { test } from "node:test";
import assert from "node:assert/strict";
import { toApiError } from "../src/utils/dbError.js";

test("unique de fondo de emergencia → 409 con mensaje propio", () => {
  const e = toApiError({ code: "23505", message: 'duplicate key value violates unique constraint "metas_one_emergency_fund_per_user"' });
  assert.equal(e.statusCode, 409);
  assert.equal(e.message, "Ya tienes un fondo de emergencia.");
});

test("uuid mal formado → 400", () => {
  assert.equal(toApiError({ code: "22P02", message: "invalid input syntax for type uuid" }).statusCode, 400);
});

test("FK / referencia ajena → 400", () => {
  assert.equal(toApiError({ code: "23503", message: "x" }).statusCode, 400);
});

test("no encontrado → 404", () => {
  assert.equal(toApiError({ code: "P0002", message: "Meta no encontrada" }).statusCode, 404);
});

test("22023 conserva nuestro mensaje", () => {
  assert.equal(toApiError({ code: "22023", message: "El monto debe ser mayor a 0" }).message, "El monto debe ser mayor a 0");
});

test("desconocido → 500 genérico, sin filtrar el mensaje de Postgres", () => {
  const e = toApiError({ code: "XX000", message: "relation public.gastos ..." });
  assert.equal(e.statusCode, 500);
  assert.equal(e.message, "Error interno del servidor");
});
