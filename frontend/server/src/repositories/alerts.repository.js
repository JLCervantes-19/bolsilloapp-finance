import { createBaseRepository } from "./base.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { toApiError } from "../utils/dbError.js";

export const alertsRepository = {
  ...createBaseRepository("alertas"),

  async markRead(supabase, id) {
    const { data, error } = await supabase.from("alertas").update({ is_read: true }).eq("id", id).select().maybeSingle();
    if (error) throw toApiError(error);
    if (!data) throw ApiError.notFound("Registro no encontrado.");
    return data;
  },
};
