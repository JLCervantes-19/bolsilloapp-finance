import { test } from "node:test";
import assert from "node:assert/strict";
import { userKey } from "../src/middlewares/rateLimit.js";

test("userKey agrupa por usuario autenticado", () => {
  assert.equal(userKey({ user: { id: "abc" }, ip: "1.1.1.1" }), "user:abc");
});

test("userKey cae a la IP si no hay usuario", () => {
  assert.equal(userKey({ ip: "1.1.1.1" }), "ip:1.1.1.1");
});
