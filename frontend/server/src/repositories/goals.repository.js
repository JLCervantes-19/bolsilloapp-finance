import { createBaseRepository } from "./base.repository.js";
import { toApiError } from "../utils/dbError.js";

export const goalsRepository = {
  ...createBaseRepository("metas"),

  async getEmergencyFund(supabase) {
    const { data, error } = await supabase.from("metas").select("*").eq("is_emergency_fund", true).maybeSingle();
    if (error) throw toApiError(error);
    return data;
  },

  async incrementCurrentAmount(supabase, id, delta) {
    const goal = await this.getById(supabase, id);
    return this.update(supabase, id, { current_amount: Number(goal.current_amount) + delta });
  },
};
