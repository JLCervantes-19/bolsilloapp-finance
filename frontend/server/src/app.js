import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { apiRouter } from "./routes/index.js";
import { notFoundMiddleware, errorMiddleware } from "./middlewares/error.middleware.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
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

  // Rate limit general — 100 req / 15 min por IP; auth más estricto (10
  // intentos / 15 min) para frenar fuerza bruta de login.
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

  app.get("/health", (req, res) => res.json({ status: "ok", env: env.nodeEnv }));

  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api", apiRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
