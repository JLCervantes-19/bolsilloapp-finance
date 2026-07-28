import { makeCrudRouter } from "./crud.factory.js";
import { budgetsRepository } from "../repositories/budgets.repository.js";
import { budgetSchema } from "../validators/index.js";

export const budgetsRouter = makeCrudRouter({
  repository: budgetsRepository,
  createSchema: budgetSchema,
});
