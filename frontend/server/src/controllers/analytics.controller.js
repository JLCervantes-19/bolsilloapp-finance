import { asyncHandler } from "../utils/asyncHandler.js";
import { getMonthlySeries } from "../services/analytics.service.js";
import { ApiError } from "../utils/ApiError.js";
import { analyticsQuerySchema } from "../validators/index.js";

export const analyticsController = {
  monthly: asyncHandler(async (req, res) => {
    const q = analyticsQuerySchema.safeParse(req.query);
    if (!q.success) throw ApiError.badRequest("months debe ser un número entre 1 y 24");
    const data = await getMonthlySeries(req.supabase, q.data.months);
    res.json({ data });
  }),
};
