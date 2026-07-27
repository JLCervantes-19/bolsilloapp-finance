// Punto de entrada serverless para Vercel. Reusa exactamente el mismo
// Express app del backend (backend/src/app.js) — la única diferencia con
// desarrollo local es que aquí nunca se llama app.listen(): Vercel invoca
// el app exportado directamente como handler (req, res) por request.
import { createApp } from "../backend/src/app.js";

const app = createApp();

export default app;
