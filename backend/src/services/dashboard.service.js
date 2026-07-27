import { categoriesRepository } from "../repositories/categories.repository.js";
import { debtsRepository } from "../repositories/debts.repository.js";
import { goalsRepository } from "../repositories/goals.repository.js";
import { investmentsRepository } from "../repositories/investments.repository.js";
import { expensesRepository } from "../repositories/expenses.repository.js";
import { incomesRepository } from "../repositories/incomes.repository.js";
import { currentMonthRange, previousMonthRange } from "../utils/dateRange.js";
import { computeHealthScore, computeNetWorth } from "./engines/financialEngine.js";
import { buildRecommendations } from "./engines/recommendationEngine.js";

/**
 * Balance disponible = todo el dinero que ha entrado menos todo lo que ha
 * salido o quedó apartado — no existe una tabla `accounts` en el schema
 * (no la pidió el prompt maestro), así que "saldo disponible" se deriva:
 *   ingresos históricos − gastos históricos − ahorro apartado − invertido
 * en vez de ser un número editable a mano.
 */
async function computeAvailableBalance(supabase) {
  const [{ data: incomes }, { data: expenses }, { data: goals }, { data: investments }] = await Promise.all([
    supabase.from("incomes").select("amount"),
    supabase.from("expenses").select("amount"),
    supabase.from("goals").select("current_amount"),
    supabase.from("investments").select("amount_invested"),
  ]);

  const totalIncome = (incomes || []).reduce((s, r) => s + Number(r.amount), 0);
  const totalExpenses = (expenses || []).reduce((s, r) => s + Number(r.amount), 0);
  const totalSaved = (goals || []).reduce((s, r) => s + Number(r.current_amount), 0);
  const totalInvested = (investments || []).reduce((s, r) => s + Number(r.amount_invested), 0);

  return totalIncome - totalExpenses - totalSaved - totalInvested;
}

export async function getDashboardSummary(supabase) {
  const currentRange = currentMonthRange();
  const previousRange = previousMonthRange();

  const [
    balance,
    monthlyIncome,
    monthlyExpenses,
    previousMonthlyExpenses,
    debts,
    goals,
    investments,
    expenseCategories,
    currentExpenses,
    previousExpenses,
  ] = await Promise.all([
    computeAvailableBalance(supabase),
    incomesRepository.sumByDateRange(supabase, currentRange.start, currentRange.end),
    expensesRepository.sumByDateRange(supabase, currentRange.start, currentRange.end),
    expensesRepository.sumByDateRange(supabase, previousRange.start, previousRange.end),
    debtsRepository.list(supabase, { filters: { status: "active" } }),
    goalsRepository.list(supabase),
    investmentsRepository.list(supabase),
    categoriesRepository.listByKind(supabase, "expense"),
    expensesRepository.listByDateRange(supabase, currentRange.start, currentRange.end),
    expensesRepository.listByDateRange(supabase, previousRange.start, previousRange.end),
  ]);

  const totalDebts = debts.reduce((s, d) => s + Number(d.balance), 0);
  const totalSavings = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalInvestments = investments.reduce((s, i) => s + Number(i.current_value), 0);
  const emergencyFund = goals.find((g) => g.is_emergency_fund) || null;

  const categorySum = (rows) => {
    const byCategory = new Map();
    for (const row of rows) {
      const name = row.categories?.name || "Sin categoría";
      const color = row.categories?.color || "#787774";
      const prev = byCategory.get(name) || { name, color, value: 0 };
      prev.value += Number(row.amount);
      byCategory.set(name, prev);
    }
    return [...byCategory.values()];
  };

  const categoryLegend = expenseCategories.map((c) => {
    const spent = currentExpenses.filter((e) => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0);
    return { id: c.id, name: c.name, color: c.color, value: spent };
  });

  const netWorth = computeNetWorth({ balance, totalSavings, totalInvestments, totalDebts });
  const health = computeHealthScore({
    monthlyIncome,
    monthlyExpenses,
    totalDebts,
    emergencyFundCurrent: emergencyFund ? Number(emergencyFund.current_amount) : 0,
  });

  const recommendations = buildRecommendations({
    monthlyIncome,
    monthlyExpenses,
    categoriesCurrent: categorySum(currentExpenses),
    categoriesPrevious: categorySum(previousExpenses),
    emergencyFundCurrent: emergencyFund ? Number(emergencyFund.current_amount) : 0,
    totalDebts,
  });

  return {
    balance,
    monthlyIncome,
    monthlyExpenses,
    monthlyExpensesChangePct: previousMonthlyExpenses
      ? Math.round(((monthlyExpenses - previousMonthlyExpenses) / previousMonthlyExpenses) * 100)
      : 0,
    totalDebts,
    totalSavings,
    totalInvestments,
    netWorth,
    health,
    emergencyFund: emergencyFund
      ? {
          ...emergencyFund,
          progressPct: Math.min(100, Math.round((Number(emergencyFund.current_amount) / Number(emergencyFund.target_amount)) * 100)),
        }
      : null,
    categoryLegend,
    recommendations,
  };
}
