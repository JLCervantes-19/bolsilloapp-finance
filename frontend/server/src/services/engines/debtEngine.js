/**
 * Motor de deudas — portado 1:1 desde simulate() en "Bolsillo App.dc.html"
 * (líneas 516-533 del prototipo). Simula mes a mes el pago de todas las
 * deudas aplicando interés compuesto mensual, el pago mínimo de cada una, y
 * el "pago extra" acumulado hacia la deuda de mayor prioridad según la
 * estrategia elegida:
 *   - snowball  (bola de nieve): prioriza el saldo más bajo primero
 *   - avalanche (avalancha):     prioriza la tasa de interés más alta primero
 *
 * `debts` = [{ id, name, balance, rate, minPayment }]
 */
export function simulate(debts, strategy, extraPayment) {
  let sim = debts.map((d) => ({ ...d, remaining: d.balance, paidMonth: null }));
  const order =
    strategy === "snowball"
      ? [...sim].sort((a, b) => a.balance - b.balance)
      : [...sim].sort((a, b) => b.rate - a.rate);

  let months = 0;
  let totalInterest = 0;
  const extra = extraPayment;

  while (sim.some((d) => d.remaining > 0.5) && months < 480) {
    months++;

    sim.forEach((d) => {
      if (d.remaining > 0) {
        const interest = (d.remaining * d.rate) / 100 / 12;
        totalInterest += interest;
        d.remaining += interest;
      }
    });

    sim.forEach((d) => {
      if (d.remaining > 0) {
        const pay = Math.min(d.minPayment, d.remaining);
        d.remaining -= pay;
      }
    });

    let pool = extra;
    for (const od of order) {
      const d = sim.find((x) => x.id === od.id);
      if (d.remaining > 0 && pool > 0) {
        const pay = Math.min(pool, d.remaining);
        d.remaining -= pay;
        pool -= pay;
      }
    }

    sim.forEach((d) => {
      if (d.remaining <= 0.5 && d.paidMonth === null) d.paidMonth = months;
    });
  }

  return {
    months,
    totalInterest: Math.round(totalInterest),
    order: order.map((od) => ({
      ...od,
      paidMonth: (sim.find((d) => d.id === od.id) || {}).paidMonth || months,
    })),
  };
}

export function compareStrategies(debts, extraPayment) {
  return {
    snowball: simulate(debts, "snowball", extraPayment),
    avalanche: simulate(debts, "avalanche", extraPayment),
  };
}
