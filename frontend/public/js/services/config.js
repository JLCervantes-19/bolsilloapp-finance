// En dev, el backend corre en :3001 (npm run dev en /backend); en prod se
// sirve el mismo origen detrás de un proxy (ver despliegue). Ajustar aquí
// si el backend vive en otro host.
export const API_BASE_URL = window.location.hostname === "localhost" ? "http://localhost:3001/api" : "/api";
