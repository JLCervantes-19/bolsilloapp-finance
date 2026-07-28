import { h, clear } from "../utils/dom.js";
import { financialService } from "../services/financialService.js";
import { fmt } from "../utils/formatters.js";
import { SummaryCard } from "../components/SummaryCard.js";
import { ChangeIndicator } from "../components/ChangeIndicator.js";
import { ProgressBar } from "../components/ProgressBar.js";
import { Gauge } from "../components/Gauge.js";
import { SectionTitle } from "../components/SectionTitle.js";
import { InsightBanner } from "../components/InsightBanner.js";
import { ActivityChart } from "../components/ActivityChart.js";
import { PageHeader } from "../components/PageHeader.js";
import { chartTheme } from "../utils/chartTheme.js";
import { DashboardSkeleton } from "../components/DashboardSkeleton.js";

const monthLabel = new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" });
const monthTitleCase = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Hola, buenos días";
  if (h < 19) return "Hola, buenas tardes";
  return "Hola, buenas noches";
}

function barConfig(labels, income, expense) {
  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Ingresos", data: income, backgroundColor: chartTheme.positive, borderRadius: 6, maxBarThickness: 18 },
        { label: "Gastos", data: expense, backgroundColor: chartTheme.negative, borderRadius: 6, maxBarThickness: 18 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: "easeOutCubic" },
      plugins: {
        legend: { position: "bottom", labels: chartTheme.legendLabels },
        tooltip: { callbacks: { label: (ctx) => " " + ctx.dataset.label + ": " + fmt(ctx.raw) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: chartTheme.tickColor, font: { size: 11 } } },
        y: { grid: { color: chartTheme.gridColor }, ticks: { color: chartTheme.tickColor, callback: (v) => "$" + (v / 1000000).toFixed(1) + "M", font: { size: 10 } } },
      },
    },
  };
}

function donutConfig(categories) {
  return {
    type: "doughnut",
    data: {
      labels: categories.map((c) => c.name),
      datasets: [{ data: categories.map((c) => c.value), backgroundColor: categories.map((c) => c.color), borderColor: chartTheme.donutBorder, borderWidth: 3, hoverOffset: 6 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      animation: { duration: 700, easing: "easeOutCubic" },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => " " + ctx.label + ": " + fmt(ctx.raw) } } },
    },
  };
}

function lineConfig(labels, networth) {
  return {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Patrimonio",
          data: networth,
          borderColor: chartTheme.lineColor,
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 220);
            g.addColorStop(0, chartTheme.lineFillTop);
            g.addColorStop(1, chartTheme.lineFillBottom);
            return g;
          },
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: chartTheme.lineColor,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: "easeOutCubic" },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => " " + fmt(ctx.raw) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: chartTheme.tickColor } },
        y: { grid: { color: chartTheme.gridColor }, ticks: { color: chartTheme.tickColor, callback: (v) => "$" + (v / 1000).toFixed(0) + "k" } },
      },
    },
  };
}

// % de cambio del patrimonio entre el primer y el último punto de la serie
// real de 6 meses — reemplaza el porcentaje inventado que traía el widget.
function netWorthChangePct(networth) {
  const first = networth?.[0] ?? 0;
  const last = networth?.[networth.length - 1] ?? 0;
  if (!first) return 0;
  return Number((((last - first) / Math.abs(first)) * 100).toFixed(2));
}

/**
 * `renderDashboard` monta UNA sola vez por navegación (lo llama el router) y
 * registra UN solo listener de "bolsillo:refresh". Adentro, `draw()` es la
 * función que realmente pinta contenido y se puede llamar muchas veces
 * (carga inicial + cada refresh) sin volver a registrar listeners — antes
 * `refresh` llamaba a `renderDashboard` de nuevo, lo que re-registraba el
 * listener en cada refresh y los apilaba (fuga: 1, luego 2, luego 4
 * renders por cada refresh sucesivo mientras el usuario seguía en el
 * dashboard).
 */
export async function renderDashboard(pageEl) {
  let charts = {};
  let lastValues = null; // valores numéricos del render anterior — null = primera carga

  function destroyCharts() {
    Object.values(charts).forEach((c) => c?.destroy());
    charts = {};
  }

  async function draw() {
    let summary, series;
    try {
      [summary, series] = await Promise.all([financialService.getDashboardSummary(), financialService.getMonthlySeries(6)]);
    } catch (err) {
      clear(pageEl);
      pageEl.appendChild(h("p", { style: "color:var(--text-secondary)" }, `No se pudo cargar el dashboard: ${err.message}`));
      return;
    }

    const currentValues = {
      balance: summary.balance,
      monthlyIncome: summary.monthlyIncome,
      monthlyExpenses: summary.monthlyExpenses,
      totalSavings: summary.totalSavings,
      totalInvestments: summary.totalInvestments,
      netWorth: summary.netWorth,
      totalDebts: summary.totalDebts,
    };
    const changed = (key) => lastValues !== null && lastValues[key] !== currentValues[key];

    const barCanvas = h("canvas");
    const donutCanvas = h("canvas");
    const lineCanvas = h("canvas");

    const expensesDown = summary.monthlyExpensesChangePct <= 0;

    const cards = [
      SummaryCard({ iconName: "wallet", tone: "positive", label: "Saldo disponible", value: summary.balance, delay: 0, pulse: changed("balance") }),
      SummaryCard({ iconName: "in", tone: "positive", label: "Ingresos del mes", value: summary.monthlyIncome, delay: 40, pulse: changed("monthlyIncome") }),
      SummaryCard({
        iconName: "out",
        tone: "negative",
        label: "Gastos del mes",
        value: summary.monthlyExpenses,
        delay: 80,
        pulse: changed("monthlyExpenses"),
        footer: ChangeIndicator({
          direction: expensesDown ? "down" : "up",
          positive: expensesDown,
          label: `${Math.abs(summary.monthlyExpensesChangePct)}% vs. mes pasado`,
        }),
      }),
      SummaryCard({ iconName: "piggy", tone: "positive", label: "Ahorro acumulado", value: summary.totalSavings, delay: 120, pulse: changed("totalSavings") }),
      SummaryCard({ iconName: "trend", tone: "positive2", label: "Inversiones", value: summary.totalInvestments, delay: 160, pulse: changed("totalInvestments") }),
      SummaryCard({ iconName: "layers", tone: "neutral", label: "Patrimonio", value: summary.netWorth, delay: 200, pulse: changed("netWorth") }),
      SummaryCard({ iconName: "card", tone: "negative2", label: "Total deudas", value: summary.totalDebts, delay: 240, pulse: changed("totalDebts") }),
      SummaryCard({
        iconName: "shield",
        tone: "warning",
        label: "Fondo de emergencia",
        value: summary.emergencyFund
          ? ProgressBar({ percent: summary.emergencyFund.progressPct, label: `${summary.emergencyFund.progressPct}% de la meta`, color: "var(--warning)" })
          : h("p", { style: "color:var(--text-secondary);font-size:var(--fs-xs)" }, "Sin meta creada"),
        delay: 280,
      }),
      SummaryCard({
        iconName: "gauge",
        tone: "dark",
        label: "Salud financiera",
        value: Gauge({ score: summary.health.score, tag: summary.health.tag }),
        delay: 320,
      }),
    ];

    clear(pageEl);
    pageEl.append(
      PageHeader({ eyebrow: greeting(), title: "Tu resumen", pillLabel: monthTitleCase }),

      SectionTitle({ label: "Resumen del mes", meta: "10 indicadores" }),
      h("section", { class: "summary-row no-scrollbar" }, cards),

      h("section", { style: "max-width:420px;margin-top:4px;--d:360", class: "glass-in" }, [
        ActivityChart({
          values: series.networth,
          changePercent: netWorthChangePct(series.networth),
          ctaLabel: "Ver salud financiera",
          onChartCreated: (chart) => (charts.activity = chart),
        }),
      ]),

      summary.recommendations.length
        ? h("div", {}, [
            SectionTitle({ label: "Recomendaciones" }),
            h(
              "section",
              { class: "summary-row no-scrollbar" },
              summary.recommendations.map((r, i) => InsightBanner({ tone: r.tone, text: r.text, delay: 400 + i * 60 }))
            ),
          ])
        : null,

      SectionTitle({ label: "Análisis" }),
      h("section", { class: "summary-grid" }, [
        h("div", { class: "chart-card glass glass-in", style: "--d:460" }, [
          h("h3", {}, "Ingresos vs. gastos"),
          h("p", {}, "Últimos 6 meses"),
          h("div", { style: "height:220px" }, [barCanvas]),
        ]),
        h("div", { class: "chart-card glass glass-in", style: "--d:500" }, [
          h("h3", {}, "Gastos por categoría"),
          h("p", {}, monthTitleCase),
          h("div", { style: "position:relative;max-width:210px;margin:0 auto;height:180px" }, [
            donutCanvas,
            h("div", { style: "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none" }, [
              h("span", { class: "text-xs", style: "color:var(--text-tertiary)" }, "Total"),
              h("span", { style: "font-size:15px;font-weight:800;color:var(--text-primary)" }, fmt(summary.monthlyExpenses)),
            ]),
          ]),
          h(
            "ul",
            { style: "list-style:none;margin:14px 0 4px;padding:0;display:flex;flex-direction:column;gap:9px" },
            summary.categoryLegend
              .filter((c) => c.value > 0)
              .map((c) =>
                h("li", { style: "display:flex;align-items:center;justify-content:space-between;font-size:12.5px;font-weight:600;color:var(--text-primary)" }, [
                  h("span", { style: "display:flex;align-items:center;gap:8px;color:var(--text-secondary)" }, [
                    h("span", { style: `width:9px;height:9px;border-radius:3px;background:${c.color};display:inline-block` }),
                    c.name,
                  ]),
                  h("span", { style: "font-weight:700" }, fmt(c.value)),
                ])
              )
          ),
        ]),
        h("div", { class: "chart-card glass glass-in", style: "grid-column:1 / -1; --d:540" }, [
          h("h3", {}, "Evolución del patrimonio"),
          h("p", {}, "Últimos 6 meses"),
          h("div", { style: "height:220px" }, [lineCanvas]),
        ]),
      ])
    );

    destroyCharts();
    if (window.Chart) {
      Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
      charts.bar = new Chart(barCanvas, barConfig(series.labels, series.income, series.expense));
      charts.donut = new Chart(donutCanvas, donutConfig(summary.categoryLegend.filter((c) => c.value > 0)));
      charts.line = new Chart(lineCanvas, lineConfig(series.labels, series.networth));
    }

    lastValues = currentValues;
  }

  // Esqueleto propio (misma forma que el contenido real) mientras carga la
  // primera vez — evita el salto de layout de un skeleton genérico.
  clear(pageEl);
  pageEl.appendChild(DashboardSkeleton());
  await draw();

  const onRefresh = () => draw();
  window.addEventListener("bolsillo:refresh", onRefresh);
  return () => {
    window.removeEventListener("bolsillo:refresh", onRefresh);
    destroyCharts();
  };
}
