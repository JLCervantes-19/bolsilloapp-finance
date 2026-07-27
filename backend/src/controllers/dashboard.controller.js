import { asyncHandler } from "../utils/asyncHandler.js";
import { getDashboardSummary } from "../services/dashboard.service.js";

export const dashboardController = {
  summary: asyncHandler(async (req, res) => {
    const data = await getDashboardSummary(req.supabase);
    res.json({ data });
  }),
};
