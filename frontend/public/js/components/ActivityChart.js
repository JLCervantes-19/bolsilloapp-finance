import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";

/** Widget "hero" — única superficie que usa negro sólido + acento naranja, por diseño. */
export function ActivityChart({ values, changePercent, ctaLabel, onCtaClick }) {
  const canvas = h("canvas", { style: "width:100%;height:64px" });
  const up = changePercent >= 0;

  const card = h("div", { class: "activity-chart glass-strong glass-in" }, [
    h("div", { class: "activity-chart__head" }, [
      h("span", { class: "activity-chart__pill" }, [Icon(up ? "up" : "down", { size: 12 }), `${up ? "+" : ""}${changePercent}%`]),
    ]),
    canvas,
    ctaLabel
      ? h("button", { type: "button", class: "activity-chart__cta", onClick: onCtaClick }, [ctaLabel, Icon("chevron", { size: 14 })])
      : null,
  ]);

  requestAnimationFrame(() => {
    if (!window.Chart) return;
    new Chart(canvas, {
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
        animation: { duration: 900, easing: "easeOutCubic" },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
    });
  });

  return card;
}
