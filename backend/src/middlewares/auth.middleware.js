import { createRequestClient, supabaseAdmin } from "../config/supabase.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Exige `Authorization: Bearer <access_token>` (el JWT que Supabase Auth le
 * entrega al frontend tras login/signup). Verifica el token contra Supabase
 * y deja listos:
 *   req.user       — el usuario autenticado
 *   req.supabase   — cliente scoped a ese usuario (RLS lo limita a sus filas)
 */
export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw ApiError.unauthorized("Falta el header Authorization: Bearer <token>");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    throw ApiError.unauthorized("Token inválido o expirado");
  }

  req.user = data.user;
  req.supabase = createRequestClient(token);
  next();
});
