import { expensesRepository } from "../repositories/expenses.repository.js";
import { incomesRepository } from "../repositories/incomes.repository.js";
import { goalsRepository } from "../repositories/goals.repository.js";
import { pocketsRepository } from "../repositories/pockets.repository.js";
import { toApiError } from "../utils/dbError.js";

/**
 * Ingesta de flujo de caja en tiempo real — port del flujo "agregar gasto/
 * ingreso rápido" del bottom sheet (submitSheet en el prototipo), incluida
 * la asignación automática de un ingreso a fondo de emergencia / inversión.
 * Cada escritura queda inmediatamente disponible para el siguiente GET
 * /api/dashboard/summary — no hay caché de por medio.
 */

export async function registerQuickExpense(supabase, userId, { bolsillo_id, category_id, amount, description, date, payment_method }) {
  return expensesRepository.create(supabase, userId, {
    bolsillo_id,
    category_id,
    payment_method,
    amount,
    description: description || "Gasto rápido",
    date,
  });
}

export async function registerQuickIncome(
  supabase,
  userId,
  { bolsillo_id, category_id, amount, description, date, payment_method, allocate_emergency_fund_pct = 0, allocate_investment_pct = 0 }
) {
  // Fondo de emergencia e inversiones son herramientas del bolsillo personal
  // predeterminado (su saldo es el que baja al apartar): la asignación
  // automática solo aplica a ingresos que entran ahí.
  if (bolsillo_id) {
    const pocket = await pocketsRepository.getById(supabase, bolsillo_id);
    if (!pocket.is_default) {
      allocate_emergency_fund_pct = 0;
      allocate_investment_pct = 0;
    }
  }

  const income = await incomesRepository.create(supabase, userId, {
    bolsillo_id,
    category_id,
    payment_method,
    amount,
    description: description || "Ingreso rápido",
    date,
  });

  let emergencyFundAllocation = null;
  let investmentAllocation = null;

  if (allocate_emergency_fund_pct > 0) {
    const emergencyFund = await goalsRepository.getEmergencyFund(supabase);
    const alloc = Math.round(amount * (allocate_emergency_fund_pct / 100));
    if (emergencyFund && alloc > 0) {
      const { data, error } = await supabase.rpc("contribute_to_goal", {
        p_goal_id: emergencyFund.id,
        p_amount: alloc,
        p_type: "automatic",
      });
      if (error) throw toApiError(error);
      emergencyFundAllocation = data.saving;
    }
  }

  if (allocate_investment_pct > 0) {
    const alloc = Math.round(amount * (allocate_investment_pct / 100));
    if (alloc > 0) {
      const { data, error } = await supabase.rpc("add_auto_investment", { p_amount: alloc });
      if (error) throw toApiError(error);
      investmentAllocation = data;
    }
  }

  return { income, emergencyFundAllocation, investmentAllocation };
}
