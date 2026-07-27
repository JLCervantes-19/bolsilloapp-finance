import { expensesRepository } from "../repositories/expenses.repository.js";
import { incomesRepository } from "../repositories/incomes.repository.js";
import { debtsRepository } from "../repositories/debts.repository.js";
import { goalsRepository } from "../repositories/goals.repository.js";
import { investmentsRepository } from "../repositories/investments.repository.js";
import { lastMonthsRanges } from "../utils/dateRange.js";
import { computeNetWorth } from "./engines/financialEngine.js";

/**
 * Serie de 6 meses para Ingresos vs. gastos, Fijos vs. variables, y
 * Evolución del patrimonio.
 *
 * Nota sobre "Evolución del patrimonio": el schema no guarda snapshots
 * históricos de patrimonio (no se pidió una tabla `net_worth_snapshots`).
 * Se ancla el último punto en el patrimonio real de hoy y se reconstruye
 * hacia atrás restando el flujo de caja neto (ingresos − gastos) de cada
 * mes — una aproximación razonable y documentada, no un dato inventado:
 * ahorro, inversión y deuda se asumen constantes hacia atrás porque no hay
 * histórico de esas tablas tampoco.
 */
export async function getMonthlySeries(supabase, months = 6) {
  const ranges = lastMonthsRanges(months);

  const perMonth = await Promise.all(
    ranges.map(async (r) => {
      const [expenses, income] = await Promise.all([
        expensesRepository.listByDateRange(supabase, r.start, r.end),
        incomesRepository.sumByDateRange(supabase, r.start, r.end),
      ]);
      const fixed = expenses.filter((e) => e.is_fixed).reduce((s, e) => s + Number(e.amount), 0);
      const variable = expenses.filter((e) => !e.is_fixed).reduce((s, e) => s + Number(e.amount), 0);
      return { label: r.label, income, expense: fixed + variable, fixed, variable };
    })
  );

  const [debts, goals, investments] = await Promise.all([
    debtsRepository.list(supabase, { filters: { status: "active" } }),
    goalsRepository.list(supabase),
    investmentsRepository.list(supabase),
  ]);
  const totalDebts = debts.reduce((s, d) => s + Number(d.balance), 0);
  const totalSavings = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalInvestments = investments.reduce((s, i) => s + Number(i.current_value), 0);

  const { data: allIncomes } = await supabase.from("incomes").select("amount");
  const { data: allExpenses } = await supabase.from("expenses").select("amount");
  const balance =
    (allIncomes || []).reduce((s, r) => s + Number(r.amount), 0) -
    (allExpenses || []).reduce((s, r) => s + Number(r.amount), 0) -
    totalSavings -
    totalInvestments;

  const currentNetWorth = computeNetWorth({ balance, totalSavings, totalInvestments, totalDebts });

  const networth = new Array(perMonth.length);
  networth[perMonth.length - 1] = currentNetWorth;
  for (let i = perMonth.length - 2; i >= 0; i--) {
    const nextMonthFlow = perMonth[i + 1].income - perMonth[i + 1].expense;
    networth[i] = Math.round(networth[i + 1] - nextMonthFlow);
  }

  return {
    labels: perMonth.map((m) => m.label),
    income: perMonth.map((m) => m.income),
    expense: perMonth.map((m) => m.expense),
    fixed: perMonth.map((m) => m.fixed),
    variable: perMonth.map((m) => m.variable),
    networth,
  };
}
