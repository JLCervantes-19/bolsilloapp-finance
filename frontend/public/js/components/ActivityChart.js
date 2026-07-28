import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";

/** Widget "hero" — superficie Liquid Glass con acento naranja. */
export function ActivityChart({ values, changePercent, ctaLabel, onCtaClick, onChartCreated }) {
  const canvas = h("canvas", { style: "width:100%;height:64px" });
  const up = changePercent >= 0;

  // Sin `.glass-in`: los gráficos no llevan animación de entrada ni de
  // dibujo — solo se anima el conteo de los números en SummaryCard. Chart.js
  // se crea directo, sin animación propia (`animation: false`), para que no
  // haya ningún movimiento que se sienta "inestable" al entrar.
  const card = h("div", { class: "activity-chart glass-strong" }, [
    h("div", { class: "activity-chart__head" }, [
      h("span", { class: "activity-chart__pill" }, [Icon(up ? "up" : "down", { size: 12 }), `${up ? "+" : ""}${changePercent}%`]),
    ]),
    canvas,
    ctaLabel
      ? h("button", { type: "button", class: "activity-chart__cta", onClick: onCtaClick }, [ctaLabel, Icon("chevron", { size: 14 })])
      : null,
  ]);

  if (window.Chart) {
    const chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: values.map((_, i) => i),
        datasets: [
          {
            data: values,
            borderColor: "#ff9466",
            borderWidth: 2.5,
            tension: 0.4,
            pointRadius: 0,
            fill: true,
            backgroundColor: (ctx) => {
              const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 64);
              gradient.addColorStop(0, "rgba(255,148,102,0.35)");
              gradient.addColorStop(1, "rgba(255,148,102,0)");
              return gradient;
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
    });
    onChartCreated?.(chart);
  }

  return card;
}
