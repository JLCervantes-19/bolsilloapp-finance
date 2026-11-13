import { ApiError } from "../utils/ApiError.js";
import { toApiError } from "../utils/dbError.js";

export const profilesRepository = {
  async get(supabase, userId) {
    const { data, error } = await supabase.from("usuarios").select("*").eq("id", userId).maybeSingle();
    if (error) throw toApiError(error);
    if (!data) throw ApiError.notFound("Registro no encontrado.");
    return data;
  },

  async update(supabase, userId, payload) {
    const { data, error } = await supabase.from("usuarios").update(payload).eq("id", userId).select().maybeSingle();
    if (error) throw toApiError(error);
    if (!data) throw ApiError.notFound("Registro no encontrado.");
    return data;
  },
};
