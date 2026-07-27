import { h, clear } from "../utils/dom.js";
import { financialService } from "../services/financialService.js";
import { fmt } from "../utils/formatters.js";
import { PageHeader } from "../components/PageHeader.js";
import { chartTheme } from "../utils/chartTheme.js";

let charts = {};
function destroyCharts() {
  Object.values(charts).forEach((c) => c?.destroy());
  charts = {};
}

const monthLabel = new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" });
const monthTitleCase = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

function baseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: "easeOutCubic" },
    ...extra,
  };
}

export async function renderAnalitica(pageEl) {
  let summary, series;
  try {
    [summary, series] = await Promise.all([financialService.getDashboardSummary(), financialService.getMonthlySeries(6)]);
  } catch (err) {
    clear(pageEl);
    pageEl.appendChild(h("p", { style: "color:var(--text-secondary)" }, `No se pudo cargar analítica: ${err.message}`));
    return;
  }

  const barCanvas = h("canvas");
  const stackCanvas = h("canvas");
  const donutCanvas = h("canvas");
  const lineCanvas = h("canvas");

  clear(pageEl);
  pageEl.append(
    PageHeader({ eyebrow: "Últimos 6 meses", title: "Analítica" }),
    h("section", { class: "analytics-grid" }, [
      h("div", { class: "chart-card glass" }, [h("h3", {}, "Ingresos vs. gastos"), h("p", {}, "Últimos 6 meses"), h("div", { style: "height:280px" }, [barCanvas])]),
      h("div", { class: "chart-card glass" }, [h("h3", {}, "Fijos vs. variables"), h("p", {}, "Últimos 6 meses"), h("div", { style: "height:280px" }, [stackCanvas])]),
      h("div", { class: "chart-card glass" }, [
        h("h3", {}, "Gastos por categoría"),
        h("p", {}, monthTitleCase),
        h("div", { style: "height:280px;max-width:260px;margin:0 auto" }, [donutCanvas]),
      ]),
      h("div", { class: "chart-card glass" }, [h("h3", {}, "Evolución del patrimonio"), h("p", {}, "Últimos 6 meses"), h("div", { style: "height:280px" }, [lineCanvas])]),
    ])
  );

  destroyCharts();
  if (!window.Chart) return;

  const gridColor = chartTheme.gridColor;
  const tickColor = chartTheme.tickColor;

  charts.bar = new Chart(barCanvas, {
    type: "bar",
    data: {
      labels: series.labels,
      datasets: [
        { label: "Ingresos", data: series.income, backgroundColor: chartTheme.positive, borderRadius: 6, maxBarThickness: 22 },
        { label: "Gastos", data: series.expense, backgroundColor: chartTheme.negative, borderRadius: 6, maxBarThickness: 22 },
      ],
    },
    options: baseOptions({
      plugins: { legend: { position: "bottom", labels: chartTheme.legendLabels }, tooltip: { callbacks: { label: (ctx) => " " + ctx.dataset.label + ": " + fmt(ctx.raw) } } },
      scales: { x: { grid: { display: false }, ticks: { color: tickColor } }, y: { grid: { color: gridColor }, ticks: { color: tickColor, callback: (v) => "$" + (v / 1000000).toFixed(1) + "M" } } },
    }),
  });

  charts.stack = new Chart(stackCanvas, {
    type: "bar",
    data: {
      labels: series.labels,
      datasets: [
        { label: "Fijos", data: series.fixed, backgroundColor: chartTheme.fixed, borderRadius: 4, maxBarThickness: 26 },
        { label: "Variables", data: series.variable, backgroundColor: chartTheme.variable, borderRadius: 4, maxBarThickness: 26 },
      ],
    },
    options: baseOptions({
      plugins: { legend: { position: "bottom", labels: chartTheme.legendLabels } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { color: tickColor } }, y: { stacked: true, grid: { color: gridColor }, ticks: { color: tickColor, callback: (v) => "$" + (v / 1000000).toFixed(1) + "M" } } },
    }),
  });

  const categories = summary.categoryLegend.filter((c) => c.value > 0);
  charts.donut = new Chart(donutCanvas, {
    type: "doughnut",
    data: { labels: categories.map((c) => c.name), datasets: [{ data: categories.map((c) => c.value), backgroundColor: categories.map((c) => c.color), borderColor: chartTheme.donutBorder, borderWidth: 3, hoverOffset: 6 }] },
    options: baseOptions({ cutout: "68%", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => " " + ctx.label + ": " + fmt(ctx.raw) } } } }),
  });

  charts.line = new Chart(lineCanvas, {
    type: "line",
    data: {
      labels: series.labels,
      datasets: [
        {
          label: "Patrimonio",
          data: series.networth,
          borderColor: chartTheme.lineColor,
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 280);
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
    options: baseOptions({
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => " " + fmt(ctx.raw) } } },
      scales: { x: { grid: { display: false }, ticks: { color: tickColor } }, y: { grid: { color: gridColor }, ticks: { color: tickColor, callback: (v) => "$" + (v / 1000).toFixed(0) + "k" } } },
    }),
  });

  return () => destroyCharts();
}
