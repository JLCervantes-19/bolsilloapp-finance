import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Controlador CRUD genérico para recursos "planos" (categories, debts,
 * budgets, goals, savings, investments, alerts) — list/get/create/update/
 * delete son idénticos entre ellos; lo único que cambia es la tabla
 * (inyectada vía `repository`) y el schema de validación (aplicado antes,
 * como middleware, en la ruta).
 */
export function makeCrudController(repository) {
  return {
    list: asyncHandler(async (req, res) => {
      const data = await repository.list(req.supabase);
      res.json({ data });
    }),

    getOne: asyncHandler(async (req, res) => {
      const data = await repository.getById(req.supabase, req.params.id);
      res.json({ data });
    }),

    create: asyncHandler(async (req, res) => {
      const data = await repository.create(req.supabase, req.user.id, req.body);
      res.status(201).json({ data });
    }),

    update: asyncHandler(async (req, res) => {
      const data = await repository.update(req.supabase, req.params.id, req.body);
      res.json({ data });
    }),

    remove: asyncHandler(async (req, res) => {
      await repository.remove(req.supabase, req.params.id);
      res.status(204).send();
    }),
  };
}
