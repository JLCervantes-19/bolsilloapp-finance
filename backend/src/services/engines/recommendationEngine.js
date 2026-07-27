/**
 * Motor de recomendaciones — portado 1:1 desde recommendations() en
 * "Bolsillo App.dc.html" (líneas 535-558 del prototipo). Genera las
 * insight cards que el frontend pinta como InsightBanner.
 *
 * Diferencia con el prototipo: el mockup comparaba contra un
 * `categoryBaseline` fijo hardcodeado; aquí se compara el gasto por
 * categoría del mes actual contra el mes calendario anterior, calculado a
 * partir de `expenses` real. La fórmula de "% de cambio" es la misma.
 *
 * El `tone` de cada recomendación se mapea a los tres tonos que admite
 * `alerts.tone` en el schema (positive | warning | negative): el mockup
 * usa 'good' y 'tip' para mensajes alentadores/informativos → 'positive';
 * 'warn' para mensajes que sugieren revisar algo → 'warning'.
 */
export function buildRecommendations({
  monthlyIncome,
  monthlyExpenses,
  categoriesCurrent,
  categoriesPrevious,
  emergencyFundCurrent,
  totalDebts,
}) {
  const list = [];
  const income = monthlyIncome;
  const expenses = monthlyExpenses;

  const rate = income ? Math.round(((income - expenses) / income) * 100) : 0;
  if (rate >= 25) {
    list.push({ tone: "positive", type: "savings_rate", text: `🎉 Tu tasa de ahorro este mes es de ${rate}%. Vas muy bien con tus finanzas.` });
  } else if (rate < 10) {
    list.push({ tone: "warning", type: "savings_rate", text: `Tu tasa de ahorro bajó a ${rate}%. Vale la pena revisar tus gastos variables.` });
  } else {
    list.push({ tone: "positive", type: "savings_rate", text: `Tu tasa de ahorro este mes es de ${rate}%. Vas por buen camino.` });
  }

  let topCat = null;
  let topPct = 0;
  const previousByName = new Map(categoriesPrevious.map((c) => [c.name, c.value]));
  categoriesCurrent.forEach((c) => {
    const base = previousByName.get(c.name) ?? c.value;
    const pct = base ? ((c.value - base) / base) * 100 : 0;
    if (pct > topPct) {
      topPct = pct;
      topCat = c.name;
    }
  });
  if (topCat && topPct >= 15) {
    list.push({
      tone: "warning",
      type: "category_spike",
      text: `Tus gastos en ${topCat.toLowerCase()} subieron ${Math.round(topPct)}% frente al mes anterior.`,
    });
  }

  const emergencyMonths = expenses ? emergencyFundCurrent / expenses : 0;
  list.push({
    tone: "positive",
    type: "emergency_fund",
    text: `Tu fondo de emergencia cubre ${emergencyMonths.toFixed(1)} meses de gastos. La meta recomendada es de 3 a 6 meses.`,
  });

  if (totalDebts > income * 2) {
    list.push({
      tone: "warning",
      type: "debt_ratio",
      text: `Tu deuda total equivale a ${(totalDebts / (income || 1)).toFixed(1)} meses de ingreso. Considera priorizar el pago con la estrategia Avalancha.`,
    });
  }

  return list;
}
