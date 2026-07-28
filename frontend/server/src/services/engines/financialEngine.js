/**
 * Motor financiero — portado 1:1 desde computeNetWorth()/computeHealthScore()
 * en "Bolsillo App.dc.html" (líneas 502-514 del prototipo). Misma fórmula,
 * ahora recibiendo los totales ya agregados desde Postgres en vez de leerlos
 * de React state.
 */

export function computeNetWorth({ balance, totalSavings, totalInvestments, totalDebts }) {
  return balance + totalSavings + totalInvestments - totalDebts;
}

export function computeHealthScore({ monthlyIncome, monthlyExpenses, totalDebts, emergencyFundCurrent }) {
  const income = monthlyIncome;
  const expenses = monthlyExpenses;
  const savingsRate = income ? (income - expenses) / income : 0;
  const debtRatio = totalDebts / (income * 12 || 1);
  const emergencyMonths = expenses ? emergencyFundCurrent / expenses : 0;

  let score = 45 + savingsRate * 120 - debtRatio * 40 + Math.min(emergencyMonths, 6) * 3;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let tag = "Atención";
  if (score >= 80) tag = "Excelente";
  else if (score >= 65) tag = "Muy bueno";
  else if (score >= 45) tag = "Regular";

  return { score, tag };
}

export function computeCapacidadPagoPct({ totalMinPayments, monthlyIncome }) {
  return Math.round((totalMinPayments / (monthlyIncome || 1)) * 100);
}

export function computeDebtToIncomeMonths({ totalDebts, monthlyIncome }) {
  return Number((totalDebts / (monthlyIncome || 1)).toFixed(1));
}
