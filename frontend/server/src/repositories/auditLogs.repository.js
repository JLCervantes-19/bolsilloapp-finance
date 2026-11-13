import { toApiError } from "../utils/dbError.js";

/** Solo lectura — las filas las escribe el trigger log_audit() en Postgres. */
export const auditLogsRepository = {
  async list(supabase, { limit = 50 } = {}) {
    const { data, error } = await supabase
      .from("auditoria")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw toApiError(error);
    return data;
  },
};
