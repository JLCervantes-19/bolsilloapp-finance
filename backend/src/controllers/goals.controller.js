import { asyncHandler } from "../utils/asyncHandler.js";
import { goalsRepository } from "../repositories/goals.repository.js";
import { savingsRepository } from "../repositories/savings.repository.js";
import { ApiError } from "../utils/ApiError.js";

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
   * Registra el abono en `savings` y suma `amount` al `current_amount` de
   * la meta — el mismo flujo de "Abonar" del prototipo (submitGoalContribution).
   */
  contribute: asyncHandler(async (req, res) => {
    const { amount } = req.body;
    if (!amount || amount <= 0) throw ApiError.badRequest("El monto debe ser mayor a 0");

    const goal = await goalsRepository.getById(req.supabase, req.params.id);
    const updatedGoal = await goalsRepository.update(req.supabase, req.params.id, {
      current_amount: Number(goal.current_amount) + amount,
    });
    const saving = await savingsRepository.create(req.supabase, req.user.id, {
      goal_id: req.params.id,
      amount,
      type: goal.is_emergency_fund ? "emergency" : "manual",
    });

    res.status(201).json({ data: { goal: updatedGoal, saving } });
  }),
};
