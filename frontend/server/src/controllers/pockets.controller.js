import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { pocketsRepository } from "../repositories/pockets.repository.js";
import { transfersRepository } from "../repositories/transfers.repository.js";
import { movementsRepository } from "../repositories/movements.repository.js";
import { getConsolidatedOverview, getPocketOverview, getPocketWithMetrics, listPocketsWithMetrics } from "../services/pockets.service.js";
import { dateRangeQuerySchema, movementsQuerySchema, pocketQuerySchema } from "../validators/index.js";

function parseRange(query) {
  const q = dateRangeQuerySchema.safeParse(query);
  if (!q.success) throw ApiError.badRequest("Rango de fechas inválido (formato YYYY-MM-DD)");
  if (q.data.start && q.data.end && q.data.start > q.data.end) throw ApiError.badRequest("La fecha inicial es posterior a la final");
  return q.data;
}

export const pocketsController = {
  // GET /pockets → bolsillos con saldo y métricas del periodo (mes en curso por defecto)
  list: asyncHandler(async (req, res) => {
    const { range, pockets } = await listPocketsWithMetrics(req.supabase, parseRange(req.query));
    res.json({ data: pockets, range });
  }),

  getOne: asyncHandler(async (req, res) => {
    const { pocket, range } = await getPocketWithMetrics(req.supabase, req.params.id, parseRange(req.query));
    res.json({ data: pocket, range });
  }),

  overview: asyncHandler(async (req, res) => {
    const data = await getPocketOverview(req.supabase, req.params.id, parseRange(req.query));
    res.json({ data });
  }),

  consolidated: asyncHandler(async (req, res) => {
    const data = await getConsolidatedOverview(req.supabase, parseRange(req.query));
    res.json({ data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await pocketsRepository.create(req.supabase, req.user.id, req.body);
    res.status(201).json({ data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await pocketsRepository.update(req.supabase, req.params.id, req.body);
    res.json({ data });
  }),

  remove: asyncHandler(async (req, res) => {
    const data = await pocketsRepository.remove(req.supabase, req.params.id, req.body || {});
    res.json({ data });
  }),
};

export const transfersController = {
  list: asyncHandler(async (req, res) => {
    const pq = pocketQuerySchema.safeParse({ bolsillo: req.query.bolsillo });
    if (!pq.success) throw ApiError.badRequest("Bolsillo inválido");
    const kind = ["aporte", "retiro", "traslado"].includes(req.query.kind) ? req.query.kind : undefined;
    const data = await transfersRepository.list(req.supabase, { bolsillo: pq.data.bolsillo, kind, ...parseRange(req.query) });
    res.json({ data });
  }),
  getOne: asyncHandler(async (req, res) => {
    res.json({ data: await transfersRepository.getById(req.supabase, req.params.id) });
  }),
  create: asyncHandler(async (req, res) => {
    const data = await transfersRepository.create(req.supabase, req.user.id, req.body);
    res.status(201).json({ data });
  }),
  update: asyncHandler(async (req, res) => {
    res.json({ data: await transfersRepository.update(req.supabase, req.params.id, req.body) });
  }),
  remove: asyncHandler(async (req, res) => {
    await transfersRepository.remove(req.supabase, req.params.id);
    res.status(204).send();
  }),
};

export const movementsController = {
  // GET /movements?bolsillo&tipo&start&end&categoria&metodo&q&page&pageSize
  list: asyncHandler(async (req, res) => {
    const q = movementsQuerySchema.safeParse(req.query);
    if (!q.success) throw ApiError.badRequest("Filtros inválidos");
    if (q.data.start && q.data.end && q.data.start > q.data.end) throw ApiError.badRequest("La fecha inicial es posterior a la final");
    const { rows, total } = await movementsRepository.list(req.supabase, q.data);
    res.json({ data: rows, page: q.data.page, pageSize: q.data.pageSize, total });
  }),
};
