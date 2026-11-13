import { test } from "node:test";
import assert from "node:assert/strict";
import { errorMiddleware } from "../src/middlewares/error.middleware.js";

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("JSON mal formado (body-parser) → 400, no 500", () => {
  const err = Object.assign(new SyntaxError("Unexpected token"), { type: "entity.parse.failed", status: 400, statusCode: 400 });
  const res = fakeRes();
  errorMiddleware(err, {}, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.message, "El cuerpo de la solicitud no es JSON válido.");
});

test("cuerpo demasiado grande → 413", () => {
  const err = Object.assign(new Error("too large"), { type: "entity.too.large", status: 413, statusCode: 413 });
  const res = fakeRes();
  errorMiddleware(err, {}, res, () => {});
  assert.equal(res.statusCode, 413);
});

test("error inesperado sigue siendo 500 genérico", () => {
  const res = fakeRes();
  const original = console.error;
  console.error = () => {};
  errorMiddleware(new Error("boom interno"), {}, res, () => {});
  console.error = original;
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error.message, "Error interno del servidor");
});
