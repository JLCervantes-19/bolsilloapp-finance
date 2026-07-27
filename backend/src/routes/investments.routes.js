import { makeCrudRouter } from "./crud.factory.js";
import { investmentsRepository } from "../repositories/investments.repository.js";
import { investmentSchema } from "../validators/index.js";

export const investmentsRouter = makeCrudRouter({
  repository: investmentsRepository,
  createSchema: investmentSchema,
});
