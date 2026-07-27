import { ApiError } from "../utils/ApiError.js";

/**
 * Valida req.body contra un schema zod. En caso de error, adjunta el detalle
 * de zod (campo + mensaje) para que el frontend pueda mostrarlo inline.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw ApiError.badRequest("Datos inválidos", result.error.flatten().fieldErrors);
    }
    req.body = result.data;
    next();
  };
}
