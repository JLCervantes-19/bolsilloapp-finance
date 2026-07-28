// Punto de entrada serverless para Vercel. Reusa exactamente el mismo
// Express app del backend (server/src/app.js) — la única diferencia con
// desarrollo local es que aquí nunca se llama app.listen(): Vercel invoca
// el app exportado directamente como handler (req, res) por request.
//
// server/ vive ADENTRO de frontend/ a propósito (no como ../../backend/
// suelto en la raíz): Node resuelve node_modules subiendo desde el
// archivo que hace el import, y en Vercel solo se instala
// frontend/node_modules — un backend/ fuera de ese árbol nunca podría
// resolver sus propias dependencias (express, etc.) en producción,
// aunque localmente sí funcionara por tener su node_modules propio.
import { createApp } from "../server/src/app.js";

const app = createApp();

export default app;
