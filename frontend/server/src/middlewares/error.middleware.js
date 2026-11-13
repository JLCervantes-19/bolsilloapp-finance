import { ApiError } from "../utils/ApiError.js";

export function notFoundMiddleware(req, res, next) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
// Errores de body-parser (cliente mandó JSON roto o demasiado grande): son
// 4xx del cliente, no fallas del servidor.
const BODY_ERRORS = {
  "entity.parse.failed": "El cuerpo de la solicitud no es JSON válido.",
  "entity.too.large": "El cuerpo de la solicitud es demasiado grande.",
};

export function errorMiddleware(err, req, res, next) {
  if (BODY_ERRORS[err?.type]) {
    return res.status(err.status || 400).json({ error: { message: BODY_ERRORS[err.type] } });
  }

  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;
  const message = isApiError ? err.message : "Error interno del servidor";

  if (!isApiError) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      message,
      details: isApiError ? err.details : undefined,
    },
  });
}
