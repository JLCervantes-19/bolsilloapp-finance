import { Router } from "express";
import { expensesController } from "../controllers/expenses.controller.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { expenseSchema } from "../validators/index.js";

export const expensesRouter = Router();

expensesRouter.get("/", expensesController.list);
expensesRouter.get("/:id", expensesController.getOne);
expensesRouter.post("/", validateBody(expenseSchema), expensesController.create);
expensesRouter.patch("/:id", validateBody(expenseSchema.partial()), expensesController.update);
expensesRouter.delete("/:id", expensesController.remove);
