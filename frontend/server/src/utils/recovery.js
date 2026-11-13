import { randomInt, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Cuentas sin correo: el usuario entra con un nombre de usuario y recupera
 * la cuenta con un código que se le muestra una sola vez. Supabase Auth
 * exige un correo, así que se usa uno interno derivado del usuario que
 * nunca recibe mensajes (la app no envía correos).
 */
export const INTERNAL_EMAIL_DOMAIN = "usuarios.onemillionapp.vercel.app";

// 3 a 30 caracteres; empieza y termina en letra o número; sin "." o "-"
// seguidos (el correo interno no los admite).
export const USERNAME_RE = /^(?=.{3,30}$)[a-z0-9](?:[a-z0-9_]|[.-](?![.-]))*[a-z0-9_]$/;

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function usernameToEmail(username) {
  return `${normalizeUsername(username)}@${INTERNAL_EMAIL_DOMAIN}`;
}

export function isInternalEmail(email) {
  return String(email || "").toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}

// Sin 0/O, 1/I/L ni U para que no se confundan al copiarlo a mano.
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

/** Código tipo K7QM-4XPA-9RTD (12 caracteres, ~59 bits). */
export function generateRecoveryCode() {
  let raw = "";
  for (let i = 0; i < 12; i++) raw += ALPHABET[randomInt(ALPHABET.length)];
  return raw.match(/.{4}/g).join("-");
}

/** Ignora guiones, espacios y mayúsculas al comparar. */
export function normalizeRecoveryCode(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// scrypt asíncrono: no bloquea el event loop mientras calcula.
export async function hashRecoveryCode(code) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(normalizeRecoveryCode(code), salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

// Hash de relleno: si el usuario no existe se verifica contra este, para
// que la respuesta tarde lo mismo y no delate qué usuarios existen.
const DUMMY_HASH = `${"00".repeat(16)}:${"00".repeat(32)}`;

export async function verifyRecoveryCode(code, stored) {
  if (stored === undefined || stored === null) {
    await verifyRecoveryCode(code, DUMMY_HASH);
    return false;
  }
  const [saltHex, hashHex] = String(stored).split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  // Un hash corrupto decodificaría a un buffer vacío y cualquier código pasaría.
  if (expected.length !== 32) return false;
  const actual = await scryptAsync(normalizeRecoveryCode(code), Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}
