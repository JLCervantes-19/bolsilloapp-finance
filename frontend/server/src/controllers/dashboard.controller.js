import { asyncHandler } from "../utils/asyncHandler.js";
import { getDashboardSummary } from "../services/dashboard.service.js";
import { ApiError } from "../utils/ApiError.js";
import { pocketQuerySchema } from "../validators/index.js";

export const dashboardController = {
  summary: asyncHandler(async (req, res) => {
    const q = pocketQuerySchema.safeParse({ bolsillo: req.query.bolsillo });
    if (!q.success) throw ApiError.badRequest("Bolsillo inválido");
    const data = await getDashboardSummary(req.supabase, q.data);
    res.json({ data });
  }),
};
