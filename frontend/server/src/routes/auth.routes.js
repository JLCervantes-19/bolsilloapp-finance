import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { supabaseAdmin, createAuthSessionClient } from "../config/supabase.js";
import { translateAuthError } from "../utils/authErrors.js";
import {
  USERNAME_RE,
  normalizeUsername,
  usernameToEmail,
  isInternalEmail,
  generateRecoveryCode,
  hashRecoveryCode,
  verifyRecoveryCode,
} from "../utils/recovery.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

/**
 * Capa delgada sobre Supabase Auth. La app no pide ni envía correos: se
 * entra con usuario + contraseña (el correo de Supabase es interno, ver
 * utils/recovery.js) y se recupera la cuenta con un código de recuperación.
 */

// Misma política que el checklist en vivo del frontend
// (frontend/public/js/utils/passwordPolicy.js) — deben coincidir exacto.
// 6 caracteres es el mínimo que Supabase Auth exige internamente y no se
// puede bajar más.
const passwordSchema = z.string().min(6, "La contraseña debe tener al menos 6 caracteres");

const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(z.string().regex(USERNAME_RE, "El usuario debe tener de 3 a 30 caracteres: letras sin tilde, números, punto, guion o guion bajo. Sin espacios y sin terminar en punto o guion."));

const signupSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  full_name: z.string().min(1).max(120).optional(),
  accepted_privacy: z.literal(true, { error: "Debés aceptar la política de tratamiento de datos" }),
});

// `username` también acepta el correo de las cuentas creadas antes de
// quitar los correos, para que puedan entrar y elegir su usuario.
const loginSchema = z.object({
  username: z.string().trim().min(1, "Ingresá tu usuario"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

const recoverSchema = z.object({
  username: z.string().transform(normalizeUsername).pipe(z.string().min(1, "Ingresá tu usuario")),
  recovery_code: z.string().min(1, "Ingresá tu código de recuperación"),
  password: passwordSchema,
});

const loginEmail = (value) => (value.includes("@") ? value.toLowerCase() : usernameToEmail(value));

/** Genera un código nuevo, guarda solo su hash y devuelve el código en claro (se muestra una vez). */
async function issueRecoveryCode(userId, username) {
  const code = generateRecoveryCode();
  await saveRecoveryHash(userId, username, await hashRecoveryCode(code));
  return code;
}

/** Guarda (o reemplaza) el hash del código; lanza ApiError si falla. */
async function saveRecoveryHash(userId, username, codeHash) {
  const { error } = await supabaseAdmin
    .from("recuperacion_cuentas")
    .upsert({ user_id: userId, username, code_hash: codeHash, updated_at: new Date().toISOString() });
  if (error) {
    console.error("[auth] recovery upsert", error);
    if (error.code === "23505") throw ApiError.badRequest("Ese usuario ya existe. Elegí otro.");
    throw ApiError.internal("No se pudo generar el código de recuperación. Intentá de nuevo.");
  }
}

async function signIn(email, password) {
  const { data, error } = await createAuthSessionClient().auth.signInWithPassword({ email, password });
  if (error) throw ApiError.unauthorized(translateAuthError(error.message));
  return data;
}

export const authRouter = Router();

authRouter.post(
  "/signup",
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const { username, password, full_name } = req.body;
    const email = usernameToEmail(username);

    // Se crea con el cliente admin y `email_confirm: true`: el correo es
    // interno (nunca recibe mensajes) y el usuario entra de inmediato.
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, username, privacy_accepted_at: new Date().toISOString() },
    });
    if (createError) throw ApiError.badRequest(translateAuthError(createError.message));

    let recovery_code;
    try {
      recovery_code = await issueRecoveryCode(created.user.id, username);
    } catch (err) {
      // Sin código no hay forma de recuperar la cuenta: mejor no crearla.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
      throw err;
    }

    const data = await signIn(email, password);
    res.status(201).json({ data: { ...data, recovery_code } });
  })
);

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const data = await signIn(loginEmail(req.body.username), req.body.password);
    res.json({ data });
  })
);

authRouter.post(
  "/refresh",
  validateBody(z.object({ refresh_token: z.string() })),
  asyncHandler(async (req, res) => {
    const { data, error } = await createAuthSessionClient().auth.refreshSession({ refresh_token: req.body.refresh_token });
    if (error) {
      // Solo un refresh_token inválido/vencido es 401 (el frontend manda al
      // login). Límites de Supabase, caídas o red son temporales: 503, y el
      // frontend conserva la sesión para reintentar.
      const temporary = !error.status || error.status === 429 || error.status >= 500;
      throw temporary
        ? new ApiError(503, translateAuthError(error.message))
        : ApiError.unauthorized(translateAuthError(error.message));
    }
    res.json({ data });
  })
);

// Olvidé mi contraseña: usuario + código de recuperación + contraseña nueva.
// El código se reemplaza por uno nuevo al usarlo, y se cierran las demás
// sesiones (si alguien más tenía acceso, lo pierde).
authRouter.post(
  "/recover",
  validateBody(recoverSchema),
  asyncHandler(async (req, res) => {
    const { username, recovery_code, password } = req.body;
    const invalid = () => ApiError.badRequest("Usuario o código de recuperación incorrectos.");
    const { data: row, error: readError } = await supabaseAdmin
      .from("recuperacion_cuentas")
      .select("user_id, code_hash")
      .eq("username", username)
      .maybeSingle();
    if (readError) {
      console.error("[auth] recovery read", readError);
      throw ApiError.internal("No se pudo recuperar la cuenta. Intentá de nuevo.");
    }
    // Mismo mensaje (y mismo tiempo) si el usuario no existe o el código no coincide.
    if (!(await verifyRecoveryCode(recovery_code, row?.code_hash))) throw invalid();

    // Rotación condicionada al hash leído: si dos pedidos usan el mismo
    // código a la vez, solo uno la gana (el código es de un solo uso).
    const new_code = generateRecoveryCode();
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("recuperacion_cuentas")
      .update({ code_hash: await hashRecoveryCode(new_code), updated_at: new Date().toISOString() })
      .eq("user_id", row.user_id)
      .eq("code_hash", row.code_hash)
      .select("user_id");
    if (claimError) {
      console.error("[auth] recovery rotate", claimError);
      throw ApiError.internal("No se pudo recuperar la cuenta. Intentá de nuevo.");
    }
    if (!claimed?.length) throw invalid();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password });
    if (error) {
      // La contraseña no cambió: se restaura el código anterior para que siga sirviendo.
      await saveRecoveryHash(row.user_id, username, row.code_hash).catch(() => {});
      throw ApiError.badRequest(translateAuthError(error.message));
    }

    const data = await signIn(usernameToEmail(username), password);
    await supabaseAdmin.auth.admin.signOut(data.session.access_token, "others").catch(() => {});
    res.json({ data: { ...data, recovery_code: new_code } });
  })
);

// Cuentas creadas con correo: eligen usuario y reciben su código.
authRouter.post(
  "/claim-username",
  requireAuth,
  validateBody(z.object({ username: usernameSchema })),
  asyncHandler(async (req, res) => {
    // Ya lo eligió (p. ej. desde otro dispositivo): responde sin código nuevo
    // para que el cliente actualice su sesión y siga.
    if (isInternalEmail(req.user.email)) {
      return res.json({ data: { username: req.user.email.split("@")[0], recovery_code: null } });
    }
    const { username } = req.body;

    // Primero el código (reserva el usuario en la tabla) y después el correo
    // interno; si lo segundo falla se deshace lo primero y se puede reintentar.
    const recovery_code = await issueRecoveryCode(req.user.id, username);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      email: usernameToEmail(username),
      email_confirm: true,
      user_metadata: { ...req.user.user_metadata, username },
    });
    if (error) {
      await supabaseAdmin.from("recuperacion_cuentas").delete().eq("user_id", req.user.id);
      throw ApiError.badRequest(translateAuthError(error.message));
    }
    res.json({ data: { username, recovery_code } });
  })
);

// Código nuevo (si perdió el anterior). Pide la contraseña para que una
// sesión robada no alcance para quedarse con la cuenta.
authRouter.post(
  "/recovery-code",
  requireAuth,
  validateBody(z.object({ password: z.string().min(1, "Ingresá tu contraseña") })),
  asyncHandler(async (req, res) => {
    if (!isInternalEmail(req.user.email)) throw ApiError.badRequest("Primero elegí tu nombre de usuario.");
    const { data, error } = await createAuthSessionClient().auth.signInWithPassword({ email: req.user.email, password: req.body.password });
    // 400 y no 401: el cliente trata 401 como sesión vencida y cerraría la sesión.
    if (error) throw ApiError.badRequest("Contraseña incorrecta.");
    // Esa verificación abrió una sesión que nadie va a usar: se cierra.
    await supabaseAdmin.auth.admin.signOut(data.session.access_token, "local").catch(() => {});
    const username = req.user.email.split("@")[0];
    const recovery_code = await issueRecoveryCode(req.user.id, username);
    res.json({ data: { recovery_code } });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");
    if (token) await supabaseAdmin.auth.admin.signOut(token).catch(() => {});
    res.status(204).send();
  })
);

// Supresión de datos (Ley 1581): borra el usuario de Auth; el cascade de
// las FK elimina todas sus filas en public.*.
authRouter.delete(
  "/account",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);
    if (error) {
      console.error("[auth] deleteUser", error);
      throw ApiError.internal("No se pudo eliminar la cuenta. Intentá de nuevo.");
    }
    res.status(204).send();
  })
);
