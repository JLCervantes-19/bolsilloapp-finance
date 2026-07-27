import { expensesRepository } from "../repositories/expenses.repository.js";
import { incomesRepository } from "../repositories/incomes.repository.js";
import { goalsRepository } from "../repositories/goals.repository.js";
import { savingsRepository } from "../repositories/savings.repository.js";
import { investmentsRepository } from "../repositories/investments.repository.js";

/**
 * Ingesta de flujo de caja en tiempo real — port del flujo "agregar gasto/
 * ingreso rápido" del bottom sheet (submitSheet en el prototipo), incluida
 * la asignación automática de un ingreso a fondo de emergencia / inversión.
 * Cada escritura queda inmediatamente disponible para el siguiente GET
 * /api/dashboard/summary — no hay caché de por medio.
 */

export async function registerQuickExpense(supabase, userId, { category_id, amount, description, date }) {
  return expensesRepository.create(supabase, userId, {
    category_id,
    amount,
    description: description || "Gasto rápido",
    date,
  });
}

export async function registerQuickIncome(
  supabase,
  userId,
  { category_id, amount, description, date, allocate_emergency_fund_pct = 0, allocate_investment_pct = 0 }
) {
  const income = await incomesRepository.create(supabase, userId, {
    category_id,
    amount,
    description: description || "Ingreso rápido",
    date,
  });

  let emergencyFundAllocation = null;
  let investmentAllocation = null;

  if (allocate_emergency_fund_pct > 0) {
    const emergencyFund = await goalsRepository.getEmergencyFund(supabase);
    if (emergencyFund) {
      const alloc = Math.round(amount * (allocate_emergency_fund_pct / 100));
      await goalsRepository.incrementCurrentAmount(supabase, emergencyFund.id, alloc);
      emergencyFundAllocation = await savingsRepository.create(supabase, userId, {
        goal_id: emergencyFund.id,
        amount: alloc,
        type: "automatic",
      });
    }
  }

  if (allocate_investment_pct > 0) {
    const alloc = Math.round(amount * (allocate_investment_pct / 100));
    const { data: existing } = await supabase
      .from("investments")
      .select("*")
      .eq("name", "Aportes automáticos")
      .maybeSingle();

    if (existing) {
      investmentAllocation = await investmentsRepository.update(supabase, existing.id, {
        amount_invested: Number(existing.amount_invested) + alloc,
        current_value: Number(existing.current_value) + alloc,
      });
    } else {
      investmentAllocation = await investmentsRepository.create(supabase, userId, {
        name: "Aportes automáticos",
        type: "automatic",
        amount_invested: alloc,
        current_value: alloc,
      });
    }
  }

  return { income, emergencyFundAllocation, investmentAllocation };
}
