import { Router } from "express";
import { makeCrudController } from "../controllers/crud.factory.js";
import { validateBody } from "../middlewares/validate.middleware.js";

export function makeCrudRouter({ repository, createSchema, updateSchema }) {
  const router = Router();
  const controller = makeCrudController(repository);

  router.get("/", controller.list);
  router.get("/:id", controller.getOne);
  router.post("/", validateBody(createSchema), controller.create);
  router.patch("/:id", validateBody(updateSchema ?? createSchema.partial()), controller.update);
  router.delete("/:id", controller.remove);

  return router;
}
