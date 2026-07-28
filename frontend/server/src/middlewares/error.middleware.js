import { ApiError } from "../utils/ApiError.js";

export function notFoundMiddleware(req, res, next) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, next) {
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
