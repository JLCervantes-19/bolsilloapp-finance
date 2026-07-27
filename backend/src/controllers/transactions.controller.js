import { asyncHandler } from "../utils/asyncHandler.js";
import { registerQuickExpense, registerQuickIncome } from "../services/transactions.service.js";

export const transactionsController = {
  quickExpense: asyncHandler(async (req, res) => {
    const data = await registerQuickExpense(req.supabase, req.user.id, req.body);
    res.status(201).json({ data });
  }),

  quickIncome: asyncHandler(async (req, res) => {
    const data = await registerQuickIncome(req.supabase, req.user.id, req.body);
    res.status(201).json({ data });
  }),
};
