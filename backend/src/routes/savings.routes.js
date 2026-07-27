import { makeCrudRouter } from "./crud.factory.js";
import { savingsRepository } from "../repositories/savings.repository.js";
import { savingSchema } from "../validators/index.js";

export const savingsRouter = makeCrudRouter({
  repository: savingsRepository,
  createSchema: savingSchema,
});
