import { Router } from "express";
import { settingsController } from "../controllers/settings.controller.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { settingsSchema, profileSchema } from "../validators/index.js";

export const settingsRouter = Router();

settingsRouter.get("/", settingsController.get);
settingsRouter.patch("/", validateBody(settingsSchema), settingsController.update);
settingsRouter.patch("/profile", validateBody(profileSchema), settingsController.updateProfile);
