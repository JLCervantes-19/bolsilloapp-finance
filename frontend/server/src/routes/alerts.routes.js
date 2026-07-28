import { Router } from "express";
import { alertsController } from "../controllers/alerts.controller.js";

export const alertsRouter = Router();

alertsRouter.get("/", alertsController.list);
alertsRouter.post("/generate", alertsController.generate);
alertsRouter.patch("/:id/read", alertsController.markRead);
alertsRouter.delete("/:id", alertsController.remove);
