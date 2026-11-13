import { test } from "node:test";
import assert from "node:assert/strict";
import { userKey, authKey, skipNonCredentialRoutes } from "../src/middlewares/rateLimit.js";

test("userKey agrupa por usuario autenticado", () => {
  assert.equal(userKey({ user: { id: "abc" }, ip: "1.1.1.1" }), "user:abc");
});

test("userKey cae a la IP si no hay usuario", () => {
  assert.equal(userKey({ ip: "1.1.1.1" }), "ip:1.1.1.1");
});

test("authKey combina IP y usuario normalizado", () => {
  assert.equal(authKey({ ip: "1.1.1.1", body: { username: " Ana.Perez " } }), "auth:1.1.1.1:ana.perez");
  assert.equal(authKey({ ip: "1.1.1.1", body: {} }), "auth:1.1.1.1:");
});

test("logout, eliminar cuenta y refresh no cuentan como intentos de credenciales", () => {
  assert.equal(skipNonCredentialRoutes({ path: "/logout" }), true);
  assert.equal(skipNonCredentialRoutes({ path: "/account" }), true);
  assert.equal(skipNonCredentialRoutes({ path: "/refresh" }), true);
  assert.equal(skipNonCredentialRoutes({ path: "/login" }), false);
  assert.equal(skipNonCredentialRoutes({ path: "/signup" }), false);
});
