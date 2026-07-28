import { Router } from "express";
import { incomesController } from "../controllers/incomes.controller.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { incomeSchema } from "../validators/index.js";

export const incomesRouter = Router();

incomesRouter.get("/", incomesController.list);
incomesRouter.get("/:id", incomesController.getOne);
incomesRouter.post("/", validateBody(incomeSchema), incomesController.create);
incomesRouter.patch("/:id", validateBody(incomeSchema.partial()), incomesController.update);
incomesRouter.delete("/:id", incomesController.remove);
