import { createBaseRepository } from "./base.repository.js";
import { ApiError } from "../utils/ApiError.js";

export const categoriesRepository = {
  ...createBaseRepository("categorias"),

  async listByKind(supabase, kind) {
    const { data, error } = await supabase.from("categorias").select("*").eq("kind", kind).order("name");
    if (error) throw ApiError.badRequest(error.message);
    return data;
  },
};
