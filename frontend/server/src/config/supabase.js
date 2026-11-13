import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { env } from "./env.js";

// Node 24 (runtime objetivo) trae WebSocket nativo; Node <22 (p.ej. dev
// local en 20.x) no, y supabase-js instancia un RealtimeClient siempre.
// El backend no usa canales realtime, pero sin esto la sola creación del
// cliente lanza en Node <22 — se provee el polyfill solo cuando hace falta.
const realtimeOptions = typeof globalThis.WebSocket === "undefined" ? { transport: ws } : undefined;

/**
 * Cliente "anon + Authorization: Bearer <access_token del usuario>".
 * PostgREST evalúa RLS con ese JWT, así que cada request solo puede tocar
 * sus propias filas — no hace falta repetir `user_id = req.user.id` a mano
 * en cada query, RLS ya lo garantiza en la base de datos.
 */
export function createRequestClient(accessToken) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: realtimeOptions,
  });
}

/**
 * Cliente anon NUEVO por request para todo lo de Auth (login, refresh,
 * recuperación). GoTrueClient guarda en memoria la última sesión y
 * comparte el refresh en curso aunque se le pase otro refresh_token: con
 * un singleton, dos usuarios que inician sesión o renuevan a la vez en la
 * misma instancia de Vercel pueden recibir la sesión del otro.
 */
export function createAuthSessionClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: realtimeOptions,
  });
}

/**
 * Cliente con la service role key — únicamente para verificar el token de
 * acceso (auth.getUser) durante el login. Nunca se expone al cliente y
 * nunca se usa para leer/escribir datos de negocio (eso siempre pasa por
 * createRequestClient, que respeta RLS).
 */
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: realtimeOptions,
});
