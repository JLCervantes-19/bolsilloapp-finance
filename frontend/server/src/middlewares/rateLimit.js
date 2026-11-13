import rateLimit from "express-rate-limit";

const common = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Demasiadas solicitudes. Esperá un momento y volvé a intentar." } },
};

/** Clave por usuario autenticado; si no hay, por IP. */
export function userKey(req) {
  return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
}

// Anti-inundación por IP, alto a propósito: detrás de una misma IP pueden
// estar muchos usuarios legítimos (CGNAT móvil, oficinas).
export const ipFloodLimiter = rateLimit({ ...common, limit: 1000 });

/** Clave por IP + correo: frena fuerza bruta contra una cuenta sin
 * bloquear a otras personas que comparten la IP (CGNAT, oficinas). */
export function authKey(req) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  return `auth:${req.ip}:${email}`;
}

/** Rutas de /api/auth que no son intentos de credenciales. */
export function skipNonCredentialRoutes(req) {
  return ["/refresh", "/logout", "/account"].includes(req.path);
}

// Fuerza bruta de login/registro/recuperación: 20 por IP+correo y un techo
// alto por IP. /refresh tiene el suyo; logout y eliminar cuenta no cuentan.
export const authLimiter = rateLimit({ ...common, limit: 20, keyGenerator: authKey, skip: skipNonCredentialRoutes });
export const authIpLimiter = rateLimit({ ...common, limit: 200, skip: skipNonCredentialRoutes });
export const refreshLimiter = rateLimit({ ...common, limit: 600 });

// Uso normal de la API, por usuario (se monta después de requireAuth).
export const userLimiter = rateLimit({ ...common, limit: 300, keyGenerator: userKey });
