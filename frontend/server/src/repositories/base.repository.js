import { ApiError } from "../utils/ApiError.js";
import { toApiError } from "../utils/dbError.js";

/**
 * Fábrica de repositorio CRUD genérico sobre una tabla Postgres.
 *
 * El cliente Supabase pasado en cada método ya viene scoped al JWT del
 * usuario (ver middlewares/auth.middleware.js), así que RLS filtra las
 * filas automáticamente — este repositorio no repite `user_id = ...` en
 * los `select`, solo lo inyecta en los `insert` porque la policy
 * `with check (user_id = auth.uid())` lo exige explícito en el payload.
 */
export function createBaseRepository(table) {
  return {
    async list(supabase, { orderBy = "created_at", ascending = false, filters = {} } = {}) {
      let query = supabase.from(table).select("*");
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) query = query.eq(key, value);
      }
      query = query.order(orderBy, { ascending });
      const { data, error } = await query;
      if (error) throw toApiError(error);
      return data;
    },

    async getById(supabase, id) {
      const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      if (error) throw toApiError(error);
      if (!data) throw ApiError.notFound("Registro no encontrado.");
      return data;
    },

    async create(supabase, userId, payload) {
      const { data, error } = await supabase
        .from(table)
        .insert({ ...payload, user_id: userId })
        .select()
        .single();
      if (error) throw toApiError(error);
      return data;
    },

    async update(supabase, id, payload) {
      const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().maybeSingle();
      if (error) throw toApiError(error);
      if (!data) throw ApiError.notFound("Registro no encontrado.");
      return data;
    },

    async remove(supabase, id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw toApiError(error);
    },
  };
}
