import { toApiError } from "../utils/dbError.js";

/**
 * Historial unificado (vista `movimientos`, security_invoker → aplica RLS).
 * Con bolsillo: todas las filas de ese bolsillo (cada transferencia aparece
 * en el extremo que le toca). Sin bolsillo (consolidado): solo `principal`,
 * para que una transferencia interna aparezca una sola vez.
 */
export const movementsRepository = {
  async list(supabase, { bolsillo, tipo, start, end, categoria, metodo, q, page = 1, pageSize = 20 }) {
    let query = supabase.from("movimientos").select("*", { count: "exact" });
    query = bolsillo ? query.eq("bolsillo_id", bolsillo) : query.eq("principal", true);
    if (tipo) query = query.eq("tipo", tipo);
    if (start) query = query.gte("fecha", start);
    if (end) query = query.lte("fecha", end);
    if (categoria) query = query.eq("category_id", categoria);
    if (metodo) query = query.eq("metodo_pago", metodo);
    if (q) {
      // Los comodines y separadores de PostgREST se quitan: la búsqueda es texto plano.
      const term = q.replace(/[%_,.()*"\\]/g, " ").trim();
      if (term) query = query.or(`descripcion.ilike.*${term}*,categoria_nombre.ilike.*${term}*`);
    }
    const from = (page - 1) * pageSize;
    const { data, error, count } = await query
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw toApiError(error);
    return { rows: data, total: count ?? 0 };
  },

  /**
   * Todas las filas de un rango (para series y desgloses). Se lee en páginas
   * de 1000 porque PostgREST corta cada respuesta en ese máximo.
   */
  async listRange(supabase, { bolsillo, start, end }) {
    const PAGE = 1000;
    const all = [];
    for (let from = 0; ; from += PAGE) {
      let query = supabase
        .from("movimientos")
        .select("id, bolsillo_id, tipo, direccion, monto, fecha, categoria_nombre, categoria_color, contraparte_bolsillo_id, principal");
      if (bolsillo) query = query.eq("bolsillo_id", bolsillo);
      if (start) query = query.gte("fecha", start);
      if (end) query = query.lte("fecha", end);
      const { data, error } = await query.order("fecha").order("id").order("direccion").range(from, from + PAGE - 1);
      if (error) throw toApiError(error);
      all.push(...data);
      if (data.length < PAGE) return all;
    }
  },
};
