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

// Fuerza bruta de login/registro/recuperación. /refresh tiene el suyo.
export const authLimiter = rateLimit({ ...common, limit: 20, skip: (req) => req.path === "/refresh" });
export const refreshLimiter = rateLimit({ ...common, limit: 60 });

// Uso normal de la API, por usuario (se monta después de requireAuth).
export const userLimiter = rateLimit({ ...common, limit: 300, keyGenerator: userKey });
