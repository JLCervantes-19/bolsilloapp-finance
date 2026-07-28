import { asyncHandler } from "../utils/asyncHandler.js";
import { incomesRepository } from "../repositories/incomes.repository.js";
import { currentMonthRange } from "../utils/dateRange.js";

export const incomesController = {
  list: asyncHandler(async (req, res) => {
    const { start, end } = req.query.start && req.query.end ? { start: req.query.start, end: req.query.end } : currentMonthRange();
    const data = await incomesRepository.listByDateRange(req.supabase, start, end);
    res.json({ data, range: { start, end } });
  }),

  getOne: asyncHandler(async (req, res) => {
    const data = await incomesRepository.getById(req.supabase, req.params.id);
    res.json({ data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await incomesRepository.create(req.supabase, req.user.id, req.body);
    res.status(201).json({ data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await incomesRepository.update(req.supabase, req.params.id, req.body);
    res.json({ data });
  }),

  remove: asyncHandler(async (req, res) => {
    await incomesRepository.remove(req.supabase, req.params.id);
    res.status(204).send();
  }),
};
