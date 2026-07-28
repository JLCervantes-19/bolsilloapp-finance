// En dev, el backend corre en :3001 (npm run dev en frontend/server); en
// prod se sirve el mismo origen detrás de un proxy (ver despliegue). Se
// reconoce tanto "localhost" como una IP de red local (para probar desde el
// celular apuntando a la IP LAN del Mac, ej. 192.168.x.x) — cualquier otro
// host (dominio de Vercel) usa same-origin "/api".
const isLocalDev = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
  window.location.hostname
);
export const API_BASE_URL = isLocalDev ? `http://${window.location.hostname}:3001/api` : "/api";
