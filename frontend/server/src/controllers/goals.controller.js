import { asyncHandler } from "../utils/asyncHandler.js";
import { goalsRepository } from "../repositories/goals.repository.js";
import { toApiError } from "../utils/dbError.js";

export const goalsController = {
  list: asyncHandler(async (req, res) => {
    const data = await goalsRepository.list(req.supabase, { orderBy: "created_at", ascending: true });
    res.json({ data });
  }),

  getOne: asyncHandler(async (req, res) => {
    const data = await goalsRepository.getById(req.supabase, req.params.id);
    res.json({ data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await goalsRepository.create(req.supabase, req.user.id, req.body);
    res.status(201).json({ data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await goalsRepository.update(req.supabase, req.params.id, req.body);
    res.json({ data });
  }),

  remove: asyncHandler(async (req, res) => {
    await goalsRepository.remove(req.supabase, req.params.id);
    res.status(204).send();
  }),

  /**
   * POST /api/goals/:id/contribute { amount }
   * Registra el abono en `ahorros` y suma `amount` al `current_amount` de
   * la meta en una sola transacción (RPC contribute_to_goal) — dos abonos
   * simultáneos ya no se pisan.
   */
  contribute: asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase.rpc("contribute_to_goal", {
      p_goal_id: req.params.id,
      p_amount: req.body.amount,
    });
    if (error) throw toApiError(error);
    res.status(201).json({ data });
  }),
};
