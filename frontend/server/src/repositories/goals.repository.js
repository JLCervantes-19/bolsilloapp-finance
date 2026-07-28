import { createBaseRepository } from "./base.repository.js";
import { ApiError } from "../utils/ApiError.js";

export const goalsRepository = {
  ...createBaseRepository("metas"),

  async getEmergencyFund(supabase) {
    const { data, error } = await supabase.from("metas").select("*").eq("is_emergency_fund", true).maybeSingle();
    if (error) throw ApiError.badRequest(error.message);
    return data;
  },

  async incrementCurrentAmount(supabase, id, delta) {
    const goal = await this.getById(supabase, id);
    return this.update(supabase, id, { current_amount: Number(goal.current_amount) + delta });
  },
};
