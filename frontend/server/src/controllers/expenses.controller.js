import { asyncHandler } from "../utils/asyncHandler.js";
import { expensesRepository } from "../repositories/expenses.repository.js";
import { currentMonthRange } from "../utils/dateRange.js";

export const expensesController = {
  list: asyncHandler(async (req, res) => {
    const { start, end } = req.query.start && req.query.end ? { start: req.query.start, end: req.query.end } : currentMonthRange();
    const data = await expensesRepository.listByDateRange(req.supabase, start, end);
    res.json({ data, range: { start, end } });
  }),

  getOne: asyncHandler(async (req, res) => {
    const data = await expensesRepository.getById(req.supabase, req.params.id);
    res.json({ data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await expensesRepository.create(req.supabase, req.user.id, req.body);
    res.status(201).json({ data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await expensesRepository.update(req.supabase, req.params.id, req.body);
    res.json({ data });
  }),

  remove: asyncHandler(async (req, res) => {
    await expensesRepository.remove(req.supabase, req.params.id);
    res.status(204).send();
  }),
};
