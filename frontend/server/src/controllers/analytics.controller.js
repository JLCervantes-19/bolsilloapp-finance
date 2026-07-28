import { asyncHandler } from "../utils/asyncHandler.js";
import { getMonthlySeries } from "../services/analytics.service.js";

export const analyticsController = {
  monthly: asyncHandler(async (req, res) => {
    const months = Number(req.query.months) || 6;
    const data = await getMonthlySeries(req.supabase, months);
    res.json({ data });
  }),
};
