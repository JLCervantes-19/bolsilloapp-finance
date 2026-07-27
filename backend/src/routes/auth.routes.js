import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { supabaseAdmin, supabaseAnon as anonClient } from "../config/supabase.js";

/**
 * Capa delgada sobre Supabase Auth — el backend no gestiona contraseñas ni
 * sesiones propias, solo reenvía a GoTrue (auth.signInWithPassword /
 * auth.signUp) usando la anon key, igual que lo haría el propio frontend.
 * Existe para que el frontend nunca necesite la anon key embebida si se
 * prefiere pasar todo por el backend; es opcional, el frontend también
 * puede llamar a Supabase Auth directo con supabase-js.
 */

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1).max(120).optional(),
});

export const authRouter = Router();

authRouter.post(
  "/signup",
  validateBody(credentialsSchema),
  asyncHandler(async (req, res) => {
    const { email, password, full_name } = req.body;
    const { data, error } = await anonClient.auth.signUp({
      email,
      password,
      options: { data: { full_name } },
    });
    if (error) throw ApiError.badRequest(error.message);
    res.status(201).json({ data });
  })
);

authRouter.post(
  "/login",
  validateBody(credentialsSchema.pick({ email: true, password: true })),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
    if (error) throw ApiError.unauthorized(error.message);
    res.json({ data });
  })
);

authRouter.post(
  "/refresh",
  validateBody(z.object({ refresh_token: z.string() })),
  asyncHandler(async (req, res) => {
    const { data, error } = await anonClient.auth.refreshSession({ refresh_token: req.body.refresh_token });
    if (error) throw ApiError.unauthorized(error.message);
    res.json({ data });
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
