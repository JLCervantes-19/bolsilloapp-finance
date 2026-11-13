import { asyncHandler } from "../utils/asyncHandler.js";
import { expensesRepository } from "../repositories/expenses.repository.js";
import { currentMonthRange } from "../utils/dateRange.js";
import { ApiError } from "../utils/ApiError.js";
import { dateRangeQuerySchema, pocketQuerySchema } from "../validators/index.js";

export const expensesController = {
  list: asyncHandler(async (req, res) => {
    const q = dateRangeQuerySchema.safeParse(req.query);
    if (!q.success) throw ApiError.badRequest("Rango de fechas inválido (formato YYYY-MM-DD)");
    const pq = pocketQuerySchema.safeParse({ bolsillo: req.query.bolsillo });
    if (!pq.success) throw ApiError.badRequest("Bolsillo inválido");
    const { start, end } = q.data.start && q.data.end ? q.data : currentMonthRange();
    const data = await expensesRepository.listByDateRange(req.supabase, start, end, { bolsillo: pq.data.bolsillo });
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
