import { asyncHandler } from "../utils/asyncHandler.js";
import { alertsRepository } from "../repositories/alerts.repository.js";
import { getDashboardSummary } from "../services/dashboard.service.js";

export const alertsController = {
  list: asyncHandler(async (req, res) => {
    const data = await alertsRepository.list(req.supabase, { orderBy: "created_at", ascending: false });
    res.json({ data });
  }),

  /**
   * POST /api/alerts/generate — corre el Recommendation & Alert Engine
   * sobre el estado financiero actual y persiste cada insight como una fila
   * de `alerts` (para el feed de notificaciones), evitando duplicar el
   * mismo `type` el mismo día.
   */
  generate: asyncHandler(async (req, res) => {
    const summary = await getDashboardSummary(req.supabase);
    const today = new Date().toISOString().slice(0, 10);
    const existing = await alertsRepository.list(req.supabase, { orderBy: "created_at", ascending: false });
    const alreadyToday = new Set(
      existing.filter((a) => a.created_at.slice(0, 10) === today).map((a) => a.type)
    );

    const created = [];
    for (const rec of summary.recommendations) {
      if (alreadyToday.has(rec.type)) continue;
      const row = await alertsRepository.create(req.supabase, req.user.id, {
        type: rec.type,
        tone: rec.tone,
        message: rec.text,
      });
      created.push(row);
    }

    res.status(201).json({ data: created });
  }),

  markRead: asyncHandler(async (req, res) => {
    const data = await alertsRepository.markRead(req.supabase, req.params.id);
    res.json({ data });
  }),

  remove: asyncHandler(async (req, res) => {
    await alertsRepository.remove(req.supabase, req.params.id);
    res.status(204).send();
  }),
};
