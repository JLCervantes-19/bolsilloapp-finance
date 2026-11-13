import { Router } from "express";
import { makeCrudController } from "../controllers/crud.factory.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { categoriesRepository } from "../repositories/categories.repository.js";
import { categorySchema, pocketQuerySchema } from "../validators/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

export const categoriesRouter = Router();
const controller = makeCrudController(categoriesRepository);

// GET /categories?bolsillo=<id> → solo las de ese bolsillo; sin parámetro, todas.
categoriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = pocketQuerySchema.safeParse({ bolsillo: req.query.bolsillo });
    if (!q.success) throw ApiError.badRequest("Bolsillo inválido");
    const data = await categoriesRepository.list(req.supabase, { bolsillo: q.data.bolsillo });
    res.json({ data });
  })
);
categoriesRouter.get("/:id", controller.getOne);
categoriesRouter.post("/", validateBody(categorySchema), controller.create);
// El bolsillo de una categoría no se cambia (sus movimientos quedarían en otro bolsillo).
categoriesRouter.patch("/:id", validateBody(categorySchema.omit({ bolsillo_id: true }).partial()), controller.update);
categoriesRouter.delete("/:id", controller.remove);
