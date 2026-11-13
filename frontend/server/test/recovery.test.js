import { test } from "node:test";
import assert from "node:assert/strict";
import {
  USERNAME_RE,
  normalizeUsername,
  usernameToEmail,
  isInternalEmail,
  generateRecoveryCode,
  hashRecoveryCode,
  verifyRecoveryCode,
} from "../src/utils/recovery.js";

test("usuario: normaliza y valida", () => {
  assert.equal(normalizeUsername("  Ana.Perez "), "ana.perez");
  for (const ok of ["ana", "ana.perez", "juan_2", "m-1", "a.b", "ana_", "a".repeat(30)]) assert.ok(USERNAME_RE.test(ok), ok);
  for (const bad of ["ab", "ana perez", ".ana", "ana@x", "ñandu", "a".repeat(31), "ana..b", "ana.", "ana-", "a.-b", "_ana"])
    assert.ok(!USERNAME_RE.test(bad), bad);
});

test("correo interno derivado del usuario", () => {
  const email = usernameToEmail("Ana");
  assert.equal(email, "ana@usuarios.onemillionapp.vercel.app");
  assert.ok(isInternalEmail(email));
  assert.ok(!isInternalEmail("ana@gmail.com"));
});

test("código de recuperación: formato y verificación", async () => {
  const code = generateRecoveryCode();
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.notEqual(generateRecoveryCode(), code);
  const stored = await hashRecoveryCode(code);
  assert.ok(!stored.includes(code.replace(/-/g, "")));
  assert.ok(await verifyRecoveryCode(code, stored));
  assert.ok(await verifyRecoveryCode(` ${code.toLowerCase().replace(/-/g, " ")} `, stored));
  assert.ok(!(await verifyRecoveryCode("AAAA-BBBB-CCCC", stored)));
  assert.ok(!(await verifyRecoveryCode(code, "basura")));
  assert.ok(!(await verifyRecoveryCode(code, undefined)));
});

test("hash corrupto nunca valida", async () => {
  for (const bad of ["aabb:zz", "aabb:", ":abcd", "aabb:abcd"]) assert.ok(!(await verifyRecoveryCode("K7QM-4XPA-9RTD", bad)), bad);
});
