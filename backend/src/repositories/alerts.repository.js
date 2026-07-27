import { createBaseRepository } from "./base.repository.js";
import { ApiError } from "../utils/ApiError.js";

export const alertsRepository = {
  ...createBaseRepository("alerts"),

  async markRead(supabase, id) {
    const { data, error } = await supabase.from("alerts").update({ is_read: true }).eq("id", id).select().maybeSingle();
    if (error) throw ApiError.badRequest(error.message);
    if (!data) throw ApiError.notFound("alerts no encontrado");
    return data;
  },
};
