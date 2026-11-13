import { Router } from "express";
import { movementsController, pocketsController, transfersController } from "../controllers/pockets.controller.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { pocketDeleteSchema, pocketSchema, pocketUpdateSchema, transferSchema, transferUpdateSchema } from "../validators/index.js";

export const pocketsRouter = Router();
pocketsRouter.get("/", pocketsController.list);
pocketsRouter.get("/consolidated", pocketsController.consolidated);
pocketsRouter.get("/:id", pocketsController.getOne);
pocketsRouter.get("/:id/overview", pocketsController.overview);
pocketsRouter.post("/", validateBody(pocketSchema), pocketsController.create);
pocketsRouter.patch("/:id", validateBody(pocketUpdateSchema), pocketsController.update);
// DELETE con cuerpo { destino?, borrar_movimientos? }: nunca se pierden movimientos en silencio.
pocketsRouter.delete("/:id", validateBody(pocketDeleteSchema), pocketsController.remove);

export const transfersRouter = Router();
transfersRouter.get("/", transfersController.list);
transfersRouter.get("/:id", transfersController.getOne);
transfersRouter.post("/", validateBody(transferSchema), transfersController.create);
transfersRouter.patch("/:id", validateBody(transferUpdateSchema), transfersController.update);
transfersRouter.delete("/:id", transfersController.remove);

export const movementsRouter = Router();
movementsRouter.get("/", movementsController.list);
