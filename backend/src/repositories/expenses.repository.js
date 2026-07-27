import { createBaseRepository } from "./base.repository.js";
import { ApiError } from "../utils/ApiError.js";

export const expensesRepository = {
  ...createBaseRepository("expenses"),

  /** `startDate`/`endDate` en formato YYYY-MM-DD, ambos inclusive. */
  async listByDateRange(supabase, startDate, endDate) {
    const { data, error } = await supabase
      .from("expenses")
      .select("*, categories(id, name, color)")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });
    if (error) throw ApiError.badRequest(error.message);
    return data;
  },

  async sumByDateRange(supabase, startDate, endDate) {
    const rows = await this.listByDateRange(supabase, startDate, endDate);
    return rows.reduce((sum, r) => sum + Number(r.amount), 0);
  },
};
