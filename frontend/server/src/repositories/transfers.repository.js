import { createBaseRepository } from "./base.repository.js";
import { toApiError } from "../utils/dbError.js";

const base = createBaseRepository("transferencias");

/** Aportes (inversión), retiros y traslados entre bolsillos (tabla `transferencias`). */
export const transfersRepository = {
  ...base,

  async list(supabase, { bolsillo, kind, start, end } = {}) {
    let query = supabase.from("transferencias").select("*");
    if (bolsillo) query = query.or(`from_bolsillo_id.eq.${bolsillo},to_bolsillo_id.eq.${bolsillo}`);
    if (kind) query = query.eq("kind", kind);
    if (start) query = query.gte("date", start);
    if (end) query = query.lte("date", end);
    const { data, error } = await query.order("date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw toApiError(error);
    return data;
  },
};
