import "dotenv/config";

function required(name) {
  // .trim() a propósito: pegar una env var en el dashboard de Vercel deja
  // fácilmente un espacio o salto de línea de más al final, y eso alcanza
  // para que `new URL(...)` (dentro de supabase-js) tire "The string did
  // not match the expected pattern" y tumbe la función entera al arrancar
  // — antes de que el manejo de errores de Express llegue a intervenir.
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  corsOrigins: (process.env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean),
  // A dónde manda Supabase el link del correo de "restablecer contraseña".
  // Cae en el primer origen de CORS_ORIGIN (típicamente el front local o de
  // producción) si no se define explícitamente.
  frontendUrl: (process.env.FRONTEND_URL || "").trim() || (process.env.CORS_ORIGIN || "").split(",")[0]?.trim() || "http://localhost:5173",
};
