import { createBaseRepository } from "./base.repository.js";
import { ApiError } from "../utils/ApiError.js";

const MAX_CUSTOM_CATEGORIES = 3;
const base = createBaseRepository("categorias");
const normalizeName = (name) => name.trim().toLowerCase();

export const categoriesRepository = {
  ...base,

  // `deleted_at` es borrado lógico (ver migración add_soft_delete_to_categorias):
  // las categorías eliminadas dejan de listarse/filtrarse pero la fila sigue
  // existiendo para que ingresos/gastos ya clasificados conserven nombre/color.
  async list(supabase, opts = {}) {
    const rows = await base.list(supabase, opts);
    return rows.filter((c) => !c.deleted_at);
  },

  async listByKind(supabase, kind) {
    const { data, error } = await supabase.from("categorias").select("*").eq("kind", kind).is("deleted_at", null).order("name");
    if (error) throw ApiError.badRequest(error.message);
    return data;
  },

  // Las categorías por defecto se siembran al registrarse (`handle_new_user`
  // en el schema); acá solo se limitan y validan las que el usuario agrega
  // a mano desde el formulario de ingreso/gasto. La consulta trae también
  // las eliminadas (deleted_at) a propósito: cuentan para el límite de 3 y
  // su nombre queda retirado — no se puede recrear una categoría con el
  // mismo nombre que una que el usuario ya borró.
  async create(supabase, userId, payload) {
    const { data: existing, error } = await supabase.from("categorias").select("name, kind, is_default");
    if (error) throw ApiError.badRequest(error.message);

    const customCount = existing.filter((c) => !c.is_default).length;
    if (customCount >= MAX_CUSTOM_CATEGORIES) {
      throw ApiError.badRequest(`Ya tienes el máximo de ${MAX_CUSTOM_CATEGORIES} categorías personalizadas.`);
    }

    const nameTaken = existing.some((c) => c.kind === payload.kind && normalizeName(c.name) === normalizeName(payload.name));
    if (nameTaken) {
      throw ApiError.badRequest("Ya existe (o existió) una categoría con ese nombre.");
    }

    return base.create(supabase, userId, { ...payload, is_default: false });
  },

  // Borrado lógico: nunca se borra la fila (para no romper el historial de
  // ingresos/gastos ya clasificados con ella), solo se marca deleted_at.
  async remove(supabase, id) {
    const category = await base.getById(supabase, id);
    if (category.deleted_at) {
      throw ApiError.badRequest("Esta categoría ya fue eliminada.");
    }
    if (category.is_default) {
      throw ApiError.badRequest("No puedes eliminar una categoría por defecto.");
    }
    const { error } = await supabase.from("categorias").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw ApiError.badRequest(error.message);
  },
};
