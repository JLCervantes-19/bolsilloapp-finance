import { createBaseRepository } from "./base.repository.js";
import { ApiError } from "../utils/ApiError.js";

export const categoriesRepository = {
  ...createBaseRepository("categories"),

  async listByKind(supabase, kind) {
    const { data, error } = await supabase.from("categories").select("*").eq("kind", kind).order("name");
    if (error) throw ApiError.badRequest(error.message);
    return data;
  },
};
