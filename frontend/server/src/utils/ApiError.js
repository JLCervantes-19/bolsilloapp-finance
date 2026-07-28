export class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "No autenticado") {
    return new ApiError(401, message);
  }
  static forbidden(message = "No autorizado") {
    return new ApiError(403, message);
  }
  static notFound(message = "Recurso no encontrado") {
    return new ApiError(404, message);
  }
  static internal(message = "Error interno del servidor") {
    return new ApiError(500, message);
  }
}
