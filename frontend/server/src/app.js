import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import { ipFloodLimiter, authLimiter, refreshLimiter } from "./middlewares/rateLimit.js";
import { authRouter } from "./routes/auth.routes.js";
import { apiRouter } from "./routes/index.js";
import { notFoundMiddleware, errorMiddleware } from "./middlewares/error.middleware.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Vercel (y cualquier proxy) pone la IP real en X-Forwarded-For. Sin esto
  // req.ip es la IP del proxy y el rate limit trataría a todos los usuarios
  // como uno solo (100 req / 15 min compartidos por toda la app).
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      // Fail-closed: si CORS_ORIGIN no está configurado, no se permite
      // ningún origen cross-site en vez de reflejar cualquiera (`origin:
      // true` + credentials habilitaría a cualquier sitio a leer respuestas
      // autenticadas). La API no usa cookies (auth es Bearer token), así
      // que `credentials` tampoco hace falta.
      origin: env.corsOrigins.length ? env.corsOrigins : false,
    })
  );
  app.use(compression());
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Límites: ver middlewares/rateLimit.js (IP solo anti-inundación; el uso
  // normal de /api se limita por usuario dentro de apiRouter).
  app.use(ipFloodLimiter);

  app.get("/health", (req, res) => res.json({ status: "ok", env: env.nodeEnv }));

  app.use("/api/auth/refresh", refreshLimiter);
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api", apiRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
