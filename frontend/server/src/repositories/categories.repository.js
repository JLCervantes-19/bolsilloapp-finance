import { createBaseRepository } from "./base.repository.js";
import { ApiError } from "../utils/ApiError.js";

const MAX_CUSTOM_CATEGORIES = 3;
const base = createBaseRepository("categorias");
const normalizeName = (name) => name.trim().toLowerCase();

export const categoriesRepository = {
  ...base,

  async listByKind(supabase, kind) {
    const { data, error } = await supabase.from("categorias").select("*").eq("kind", kind).order("name");
    if (error) throw ApiError.badRequest(error.message);
    return data;
  },

  // Las categorías por defecto se siembran al registrarse (`handle_new_user`
  // en el schema); acá solo se limitan y validan las que el usuario agrega
  // a mano desde el formulario de ingreso/gasto.
  async create(supabase, userId, payload) {
    const { data: existing, error } = await supabase.from("categorias").select("name, kind, is_default");
    if (error) throw ApiError.badRequest(error.message);

    const customCount = existing.filter((c) => !c.is_default).length;
    if (customCount >= MAX_CUSTOM_CATEGORIES) {
      throw ApiError.badRequest(`Ya tienes el máximo de ${MAX_CUSTOM_CATEGORIES} categorías personalizadas.`);
    }

    const nameTaken = existing.some((c) => c.kind === payload.kind && normalizeName(c.name) === normalizeName(payload.name));
    if (nameTaken) {
      throw ApiError.badRequest("Ya existe una categoría con ese nombre.");
    }

    return base.create(supabase, userId, { ...payload, is_default: false });
  },
};
