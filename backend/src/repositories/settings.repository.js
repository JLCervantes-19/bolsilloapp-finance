import { ApiError } from "../utils/ApiError.js";

/** `settings` es 1:1 con el usuario (PK = user_id), la fila ya existe desde
 * el trigger handle_new_user() — este repositorio solo lee/actualiza. */
export const settingsRepository = {
  async get(supabase, userId) {
    const { data, error } = await supabase.from("configuracion").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw ApiError.badRequest(error.message);
    if (!data) throw ApiError.notFound("configuracion no encontrado");
    return data;
  },

  async update(supabase, userId, payload) {
    const { data, error } = await supabase.from("configuracion").update(payload).eq("user_id", userId).select().maybeSingle();
    if (error) throw ApiError.badRequest(error.message);
    if (!data) throw ApiError.notFound("configuracion no encontrado");
    return data;
  },
};
