import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { auditLogsRepository } from "../repositories/auditLogs.repository.js";

export const auditLogsRouter = Router();

auditLogsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    // Tope de 200 filas para que nadie pida la tabla entera de un golpe.
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const data = await auditLogsRepository.list(req.supabase, { limit });
    res.json({ data });
  })
);
