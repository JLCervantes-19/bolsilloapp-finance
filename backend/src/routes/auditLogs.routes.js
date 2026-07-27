import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { auditLogsRepository } from "../repositories/auditLogs.repository.js";

export const auditLogsRouter = Router();

auditLogsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit) || 50;
    const data = await auditLogsRepository.list(req.supabase, { limit });
    res.json({ data });
  })
);
