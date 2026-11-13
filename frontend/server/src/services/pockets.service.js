import { pocketsRepository } from "../repositories/pockets.repository.js";
import { movementsRepository } from "../repositories/movements.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { currentMonthRange, lastMonthsRanges } from "../utils/dateRange.js";

/**
 * Cálculo central de Bolsillos. Los saldos y totales salen de UNA función
 * SQL (`bolsillos_resumen`); acá solo se derivan las métricas (utilidad,
 * capital, rentabilidad) y el consolidado. Ningún otro módulo —ni el
 * frontend— calcula saldos por su cuenta.
 *
 * Regla anti-doble-conteo: aportes, retiros y traslados viven en la tabla
 * `transferencias`, nunca en `ingresos`/`gastos`. Por eso:
 *   - mueven el saldo de cada bolsillo (entradas/salidas),
 *   - pero jamás suman en ingresos ni gastos, ni por bolsillo ni globales.
 */

const num = (v) => Number(v) || 0;
const round2 = (v) => Math.round(v * 100) / 100;

/** Métricas de un bolsillo a partir de su fila de bolsillos_resumen. */
export function pocketMetrics(pocket, row = {}) {
  const ingresos = num(row.ingresos_total);
  const gastos = num(row.gastos_total);
  const aportes = num(row.aportes_total);
  const retiros = num(row.retiros_total);
  const ingresosPeriodo = num(row.ingresos_periodo);
  const gastosPeriodo = num(row.gastos_periodo);

  const metrics = {
    saldo: num(row.saldo ?? pocket.initial_balance),
    ingresos,
    gastos,
    entradas: num(row.entradas_total),
    salidas: num(row.salidas_total),
    apartado: num(row.apartado),
    periodo: {
      ingresos: ingresosPeriodo,
      gastos: gastosPeriodo,
      resultado: round2(ingresosPeriodo - gastosPeriodo),
      entradas: num(row.entradas_periodo),
      salidas: num(row.salidas_periodo),
      aportes: num(row.aportes_periodo),
      retiros: num(row.retiros_periodo),
    },
  };

  if (pocket.kind === "business") {
    // Capital invertido = saldo inicial + aportes. Los retiros no lo reducen:
    // se informan aparte (son lo que el dueño ya sacó).
    const capital = num(pocket.initial_balance) + aportes;
    const utilidadAcumulada = round2(ingresos - gastos);
    metrics.negocio = {
      utilidadPeriodo: metrics.periodo.resultado,
      utilidadAcumulada,
      capitalInvertido: capital,
      retirosAcumulados: retiros,
      aportesAcumulados: aportes,
      rentabilidadPct: capital > 0 ? round2((utilidadAcumulada / capital) * 100) : null,
    };
  }
  return metrics;
}

/** Consolidado: patrimonio = Σ saldos; ingresos/gastos = Σ de ingresos/gastos (sin transferencias). */
export function consolidate(pockets) {
  const ingresos = pockets.reduce((s, p) => s + p.metrics.periodo.ingresos, 0);
  const gastos = pockets.reduce((s, p) => s + p.metrics.periodo.gastos, 0);
  const patrimonio = pockets.reduce((s, p) => s + p.metrics.saldo, 0);
  const monedas = [...new Set(pockets.map((p) => p.currency))];
  return {
    patrimonio: round2(patrimonio),
    ingresosPeriodo: round2(ingresos),
    gastosPeriodo: round2(gastos),
    balancePeriodo: round2(ingresos - gastos),
    monedas,
    monedasMezcladas: monedas.length > 1,
    porBolsillo: pockets.map((p) => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      color: p.color,
      kind: p.kind,
      archived: Boolean(p.archived_at),
      saldo: p.metrics.saldo,
      ingresos: p.metrics.periodo.ingresos,
      gastos: p.metrics.periodo.gastos,
      resultado: p.metrics.periodo.resultado,
      participacionPct: patrimonio > 0 ? round2((p.metrics.saldo / patrimonio) * 100) : 0,
    })),
  };
}

function resolveRange({ start, end } = {}) {
  return start && end ? { start, end } : currentMonthRange();
}

/** Lista de bolsillos con sus métricas del periodo (por defecto, el mes en curso). */
export async function listPocketsWithMetrics(supabase, range) {
  const { start, end } = resolveRange(range);
  const [pockets, rows] = await Promise.all([pocketsRepository.list(supabase), pocketsRepository.summaries(supabase, start, end)]);
  const byId = new Map(rows.map((r) => [r.bolsillo_id, r]));
  return {
    range: { start, end },
    pockets: pockets.map((p) => ({ ...p, metrics: pocketMetrics(p, byId.get(p.id)) })),
  };
}

export async function getPocketWithMetrics(supabase, id, range) {
  const { range: r, pockets } = await listPocketsWithMetrics(supabase, range);
  const pocket = pockets.find((p) => p.id === id);
  if (!pocket) throw ApiError.notFound("Bolsillo no encontrado.");
  return { range: r, pocket, pockets };
}

/** Saldo de un bolsillo (lo usa el dashboard personal). */
export async function pocketBalance(supabase, id) {
  const { pocket } = await getPocketWithMetrics(supabase, id);
  return pocket.metrics.saldo;
}

function categoryBreakdown(rows, tipo) {
  const map = new Map();
  for (const r of rows) {
    if (r.tipo !== tipo) continue;
    const name = r.categoria_nombre || "Sin categoría";
    const prev = map.get(name) || { name, color: r.categoria_color || "#787774", value: 0 };
    prev.value += num(r.monto);
    map.set(name, prev);
  }
  return [...map.values()].map((c) => ({ ...c, value: round2(c.value) })).sort((a, b) => b.value - a.value);
}

/**
 * Flujo neto que cambia el saldo de un bolsillo: ingresos y entradas suman,
 * gastos y salidas restan.
 */
function pocketFlow(r) {
  return r.direccion === "entrada" ? num(r.monto) : -num(r.monto);
}

/**
 * Flujo neto que cambia el patrimonio total: ingresos/gastos, y solo las
 * transferencias con un extremo afuera (aporte externo, retiro que el dueño
 * se lleva). Un traslado interno no cambia el patrimonio.
 */
function consolidatedFlow(r) {
  if (r.tipo === "ingreso") return num(r.monto);
  if (r.tipo === "gasto") return -num(r.monto);
  if (r.contraparte_bolsillo_id) return 0;
  return r.direccion === "entrada" ? num(r.monto) : -num(r.monto);
}

/**
 * Serie mensual: ingresos, gastos, aportes, retiros y la evolución del saldo
 * (anclada en el saldo real de hoy y reconstruida hacia atrás con el flujo
 * de cada mes, igual que la evolución de patrimonio del dashboard).
 */
function monthlySeries(rows, months, currentBalance, flowFn, bolsillo) {
  const ranges = lastMonthsRanges(months);
  const per = ranges.map((r) => ({ label: r.label, start: r.start, end: r.end, ingresos: 0, gastos: 0, aportes: 0, retiros: 0, flujo: 0 }));
  for (const row of rows) {
    const m = per.find((p) => row.fecha >= p.start && row.fecha <= p.end);
    if (!m) continue;
    const monto = num(row.monto);
    if (row.tipo === "ingreso") m.ingresos += monto;
    else if (row.tipo === "gasto") m.gastos += monto;
    else if (row.tipo === "aporte" && row.direccion === "entrada") m.aportes += monto;
    else if (row.tipo === "retiro" && row.direccion === "salida") m.retiros += monto;
    m.flujo += flowFn(row);
  }
  const saldo = new Array(per.length);
  saldo[per.length - 1] = round2(currentBalance);
  for (let i = per.length - 2; i >= 0; i--) saldo[i] = round2(saldo[i + 1] - per[i + 1].flujo);
  return {
    labels: per.map((m) => m.label),
    ingresos: per.map((m) => round2(m.ingresos)),
    gastos: per.map((m) => round2(m.gastos)),
    aportes: bolsillo ? per.map((m) => round2(m.aportes)) : undefined,
    retiros: bolsillo ? per.map((m) => round2(m.retiros)) : undefined,
    saldo,
  };
}

/** Resumen de un bolsillo: métricas, serie de 6 meses y desglose por categoría del periodo. */
export async function getPocketOverview(supabase, id, range, months = 6) {
  const { range: r, pocket } = await getPocketWithMetrics(supabase, id, range);
  const series6 = lastMonthsRanges(months);
  const [periodRows, seriesRows] = await Promise.all([
    movementsRepository.listRange(supabase, { bolsillo: id, start: r.start, end: r.end }),
    movementsRepository.listRange(supabase, { bolsillo: id, start: series6[0].start, end: series6[series6.length - 1].end }),
  ]);
  return {
    range: r,
    pocket,
    categorias: { gastos: categoryBreakdown(periodRows, "gasto"), ingresos: categoryBreakdown(periodRows, "ingreso") },
    serie: monthlySeries(seriesRows, months, pocket.metrics.saldo, pocketFlow, true),
  };
}

/** Vista "Todo / Consolidado". */
export async function getConsolidatedOverview(supabase, range, months = 6) {
  const { range: r, pockets } = await listPocketsWithMetrics(supabase, range);
  const totals = consolidate(pockets);
  const series6 = lastMonthsRanges(months);
  const [periodRows, seriesRows] = await Promise.all([
    movementsRepository.listRange(supabase, { start: r.start, end: r.end }),
    movementsRepository.listRange(supabase, { start: series6[0].start, end: series6[series6.length - 1].end }),
  ]);
  const principal = (rows) => rows.filter((x) => x.principal);
  return {
    range: r,
    ...totals,
    topCategorias: categoryBreakdown(periodRows, "gasto").slice(0, 6),
    serie: monthlySeries(principal(seriesRows), months, totals.patrimonio, consolidatedFlow, false),
  };
}
