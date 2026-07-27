import { asyncHandler } from "../utils/asyncHandler.js";
import { debtsRepository } from "../repositories/debts.repository.js";
import { compareStrategies } from "../services/engines/debtEngine.js";
import { computeCapacidadPagoPct, computeDebtToIncomeMonths } from "../services/engines/financialEngine.js";
import { incomesRepository } from "../repositories/incomes.repository.js";
import { currentMonthRange } from "../utils/dateRange.js";

function toEngineDebt(row) {
  return { id: row.id, name: row.name, balance: Number(row.balance), rate: Number(row.interest_rate), minPayment: Number(row.minimum_payment) };
}

export const debtsController = {
  list: asyncHandler(async (req, res) => {
    const data = await debtsRepository.list(req.supabase, { orderBy: "priority", ascending: true });
    res.json({ data });
  }),

  getOne: asyncHandler(async (req, res) => {
    const data = await debtsRepository.getById(req.supabase, req.params.id);
    res.json({ data });
  }),

  create: asyncHandler(async (req, res) => {
    const payload = { ...req.body, original_balance: req.body.original_balance ?? req.body.balance };
    const data = await debtsRepository.create(req.supabase, req.user.id, payload);
    res.status(201).json({ data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await debtsRepository.update(req.supabase, req.params.id, req.body);
    res.json({ data });
  }),

  remove: asyncHandler(async (req, res) => {
    await debtsRepository.remove(req.supabase, req.params.id);
    res.status(204).send();
  }),

  /**
   * GET /api/debts/strategy?extraPayment=200000
   * Motor de deudas: compara bola de nieve vs. avalancha con el pago extra
   * dado, más el ratio deuda/ingreso y la capacidad de pago usada.
   */
  strategy: asyncHandler(async (req, res) => {
    const extraPayment = Number(req.query.extraPayment) || 0;
    const debts = await debtsRepository.list(req.supabase, { filters: { status: "active" } });
    const engineDebts = debts.map(toEngineDebt);
    const comparison = compareStrategies(engineDebts, extraPayment);

    const { start, end } = currentMonthRange();
    const monthlyIncome = await incomesRepository.sumByDateRange(req.supabase, start, end);
    const totalDebts = engineDebts.reduce((s, d) => s + d.balance, 0);
    const totalMinPayments = engineDebts.reduce((s, d) => s + d.minPayment, 0);

    res.json({
      data: {
        ...comparison,
        stats: {
          debtToIncomeMonths: computeDebtToIncomeMonths({ totalDebts, monthlyIncome }),
          capacidadPagoPct: computeCapacidadPagoPct({ totalMinPayments, monthlyIncome }),
        },
      },
    });
  }),
};
