import { Router } from "express";
import { goalsController } from "../controllers/goals.controller.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { goalSchema, goalContributionSchema } from "../validators/index.js";

export const goalsRouter = Router();

goalsRouter.get("/", goalsController.list);
goalsRouter.get("/:id", goalsController.getOne);
goalsRouter.post("/", validateBody(goalSchema), goalsController.create);
goalsRouter.patch("/:id", validateBody(goalSchema.partial()), goalsController.update);
goalsRouter.delete("/:id", goalsController.remove);
goalsRouter.post("/:id/contribute", validateBody(goalContributionSchema), goalsController.contribute);
