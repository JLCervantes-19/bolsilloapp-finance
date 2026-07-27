import { ApiError } from "../utils/ApiError.js";

/** Solo lectura — las filas las escribe el trigger log_audit() en Postgres. */
export const auditLogsRepository = {
  async list(supabase, { limit = 50 } = {}) {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw ApiError.badRequest(error.message);
    return data;
  },
};
