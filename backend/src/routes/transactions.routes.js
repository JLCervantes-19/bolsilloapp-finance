import { Router } from "express";
import { transactionsController } from "../controllers/transactions.controller.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { quickExpenseSchema, quickIncomeSchema } from "../validators/index.js";

export const transactionsRouter = Router();

transactionsRouter.post("/quick-expense", validateBody(quickExpenseSchema), transactionsController.quickExpense);
transactionsRouter.post("/quick-income", validateBody(quickIncomeSchema), transactionsController.quickIncome);
