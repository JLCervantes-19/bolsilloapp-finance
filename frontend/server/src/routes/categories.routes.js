import { makeCrudRouter } from "./crud.factory.js";
import { categoriesRepository } from "../repositories/categories.repository.js";
import { categorySchema } from "../validators/index.js";

export const categoriesRouter = makeCrudRouter({
  repository: categoriesRepository,
  createSchema: categorySchema,
});
