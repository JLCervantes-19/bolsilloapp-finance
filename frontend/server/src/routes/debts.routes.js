import { Router } from "express";
import { debtsController } from "../controllers/debts.controller.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { debtSchema } from "../validators/index.js";

export const debtsRouter = Router();

// Ruta estática antes que "/:id" — si no, Express intenta resolver "strategy" como :id.
debtsRouter.get("/strategy", debtsController.strategy);
debtsRouter.get("/", debtsController.list);
debtsRouter.get("/:id", debtsController.getOne);
debtsRouter.post("/", validateBody(debtSchema), debtsController.create);
debtsRouter.patch("/:id", validateBody(debtSchema.partial()), debtsController.update);
debtsRouter.delete("/:id", debtsController.remove);
