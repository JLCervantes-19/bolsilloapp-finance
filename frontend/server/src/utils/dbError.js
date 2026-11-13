import { ApiError } from "./ApiError.js";

const UNIQUE_MESSAGES = {
  metas_one_emergency_fund_per_user: "Ya tienes un fondo de emergencia.",
  budgets_user_id_category_id_month_key: "Ya existe un presupuesto para esa categoría en ese mes.",
};

/**
 * Traduce un error de PostgREST/Postgres a un ApiError con mensaje en
 * español. Nunca reenvía el texto crudo de Postgres al usuario (revela
 * nombres de tablas/columnas); lo desconocido se loguea y responde 500.
 */
export function toApiError(error) {
  switch (error?.code) {
    case "23505": {
      const constraint = /constraint "([^"]+)"/.exec(error.message || "")?.[1];
      return new ApiError(409, UNIQUE_MESSAGES[constraint] || "Ya existe un registro igual.");
    }
    case "23503":
      return ApiError.badRequest("La categoría o meta seleccionada no es válida.");
    case "22P02":
      return ApiError.badRequest("Identificador o valor con formato inválido.");
    case "23514":
    case "22007":
    case "22008":
      return ApiError.badRequest("Algún valor no es válido.");
    case "22023":
      return ApiError.badRequest(error.message);
    case "P0002":
    case "PGRST116":
      return ApiError.notFound("Registro no encontrado.");
    default:
      console.error("[db]", error);
      return ApiError.internal();
  }
}
