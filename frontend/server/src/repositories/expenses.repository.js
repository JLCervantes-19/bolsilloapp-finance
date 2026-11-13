import { createBaseRepository } from "./base.repository.js";
import { toApiError } from "../utils/dbError.js";

export const expensesRepository = {
  ...createBaseRepository("gastos"),

  /** `startDate`/`endDate` en formato YYYY-MM-DD, ambos inclusive. */
  async listByDateRange(supabase, startDate, endDate) {
    const { data, error } = await supabase
      .from("gastos")
      .select("*, categorias(id, name, color)")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });
    if (error) throw toApiError(error);
    return data;
  },

  async sumByDateRange(supabase, startDate, endDate) {
    const rows = await this.listByDateRange(supabase, startDate, endDate);
    return rows.reduce((sum, r) => sum + Number(r.amount), 0);
  },
};
