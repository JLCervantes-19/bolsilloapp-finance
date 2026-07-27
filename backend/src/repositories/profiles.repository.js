import { ApiError } from "../utils/ApiError.js";

export const profilesRepository = {
  async get(supabase, userId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw ApiError.badRequest(error.message);
    if (!data) throw ApiError.notFound("profiles no encontrado");
    return data;
  },

  async update(supabase, userId, payload) {
    const { data, error } = await supabase.from("profiles").update(payload).eq("id", userId).select().maybeSingle();
    if (error) throw ApiError.badRequest(error.message);
    if (!data) throw ApiError.notFound("profiles no encontrado");
    return data;
  },
};
