import { createBaseRepository } from "./base.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { toApiError } from "../utils/dbError.js";

const base = createBaseRepository("bolsillos");

/**
 * Bolsillos (tabla `bolsillos`). RLS limita todo al usuario del JWT; las
 * reglas del predeterminado (no se borra, no se archiva, no cambia de tipo)
 * viven en el trigger proteger_bolsillo_predeterminado.
 */
export const pocketsRepository = {
  ...base,

  async list(supabase) {
    const { data, error } = await supabase
      .from("bolsillos")
      .select("*")
      .order("is_default", { ascending: false })
      .order("position")
      .order("created_at");
    if (error) throw toApiError(error);
    return data;
  },

  async getDefault(supabase) {
    const { data, error } = await supabase.from("bolsillos").select("*").eq("is_default", true).maybeSingle();
    if (error) throw toApiError(error);
    if (!data) throw ApiError.notFound("No se encontró tu bolsillo personal.");
    return data;
  },

  async update(supabase, id, { archived, ...payload }) {
    const patch = { ...payload };
    if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
    return base.update(supabase, id, patch);
  },

  /** Borra con la función de la base: mueve los movimientos a `destino` o los borra si se pidió explícitamente. */
  async remove(supabase, id, { destino = null, borrar_movimientos = false } = {}) {
    const { data, error } = await supabase.rpc("eliminar_bolsillo", {
      p_id: id,
      p_destino: destino,
      p_borrar_movimientos: borrar_movimientos,
    });
    if (error) throw toApiError(error);
    return data;
  },

  /** Saldos y totales de cada bolsillo (función SQL bolsillos_resumen — único cálculo de saldos). */
  async summaries(supabase, start = null, end = null) {
    const { data, error } = await supabase.rpc("bolsillos_resumen", { p_desde: start, p_hasta: end });
    if (error) throw toApiError(error);
    return data;
  },
};
