import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { supabaseAdmin, supabaseAnon as anonClient, createAuthSessionClient } from "../config/supabase.js";
import { translateAuthError } from "../utils/authErrors.js";
import { env } from "../config/env.js";

/**
 * Capa delgada sobre Supabase Auth — el backend no gestiona contraseñas ni
 * sesiones propias, solo reenvía a GoTrue (auth.signInWithPassword /
 * auth.signUp) usando la anon key, igual que lo haría el propio frontend.
 * Existe para que el frontend nunca necesite la anon key embebida si se
 * prefiere pasar todo por el backend; es opcional, el frontend también
 * puede llamar a Supabase Auth directo con supabase-js.
 */

// Misma política que el checklist en vivo del frontend
// (frontend/public/js/utils/passwordPolicy.js) — deben coincidir exacto.
const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[a-z]/, "La contraseña debe tener al menos una letra minúscula")
  .regex(/[A-Z]/, "La contraseña debe tener al menos una letra mayúscula")
  .regex(/[0-9]/, "La contraseña debe tener al menos un número");

const signupSchema = z.object({
  email: z.string().email("Ingresá un correo válido"),
  password: passwordSchema,
  full_name: z.string().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Ingresá un correo válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export const authRouter = Router();

authRouter.post(
  "/signup",
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const { email, password, full_name } = req.body;
    const { data, error } = await anonClient.auth.signUp({
      email,
      password,
      options: { data: { full_name } },
    });
    if (error) throw ApiError.badRequest(translateAuthError(error.message));
    res.status(201).json({ data });
  })
);

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
    if (error) throw ApiError.unauthorized(translateAuthError(error.message));
    res.json({ data });
  })
);

authRouter.post(
  "/refresh",
  validateBody(z.object({ refresh_token: z.string() })),
  asyncHandler(async (req, res) => {
    const { data, error } = await anonClient.auth.refreshSession({ refresh_token: req.body.refresh_token });
    if (error) throw ApiError.unauthorized(translateAuthError(error.message));
    res.json({ data });
  })
);

authRouter.post(
  "/forgot-password",
  validateBody(z.object({ email: z.string().email("Ingresá un correo válido") })),
  asyncHandler(async (req, res) => {
    // Supabase no revela si el correo existe o no (evita enumeración de
    // usuarios) — siempre respondemos el mismo mensaje genérico, incluso si
    // `error` viene poblado por un correo inexistente.
    await anonClient.auth.resetPasswordForEmail(req.body.email, {
      redirectTo: env.frontendUrl,
    });
    res.json({ data: { message: "Si el correo existe, te enviamos un link para restablecer tu contraseña." } });
  })
);

authRouter.post(
  "/reset-password",
  validateBody(
    z.object({
      access_token: z.string().min(1, "Link de recuperación inválido"),
      refresh_token: z.string().min(1, "Link de recuperación inválido"),
      password: passwordSchema,
    })
  ),
  asyncHandler(async (req, res) => {
    const { access_token, refresh_token, password } = req.body;
    const client = createAuthSessionClient();
    const { error: sessionError } = await client.auth.setSession({ access_token, refresh_token });
    if (sessionError) throw ApiError.unauthorized("El link de recuperación expiró o ya se usó — pedí uno nuevo.");

    const { error } = await client.auth.updateUser({ password });
    if (error) throw ApiError.badRequest(translateAuthError(error.message));
    res.json({ data: { message: "Contraseña actualizada" } });
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
