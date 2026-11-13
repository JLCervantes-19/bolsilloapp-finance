import { createBaseRepository } from "./base.repository.js";
import { toApiError } from "../utils/dbError.js";

export const expensesRepository = {
  ...createBaseRepository("gastos"),

  /** `startDate`/`endDate` en formato YYYY-MM-DD, ambos inclusive. */
  async listByDateRange(supabase, startDate, endDate, { bolsillo } = {}) {
    let query = supabase
      .from("gastos")
      .select("*, categorias(id, name, color)")
      .gte("date", startDate)
      .lte("date", endDate);
    if (bolsillo) query = query.eq("bolsillo_id", bolsillo);
    const { data, error } = await query.order("date", { ascending: false });
    if (error) throw toApiError(error);
    return data;
  },

  async sumByDateRange(supabase, startDate, endDate, opts) {
    const rows = await this.listByDateRange(supabase, startDate, endDate, opts);
    return rows.reduce((sum, r) => sum + Number(r.amount), 0);
  },
};
