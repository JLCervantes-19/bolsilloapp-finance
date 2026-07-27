import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";
import { animateNumber } from "../hooks/useAnimatedNumber.js";
import { fmt } from "../utils/formatters.js";

const TONE_CLASS = {
  positive: "summary-card--positive",
  positive2: "summary-card--positive2",
  negative: "summary-card--negative",
  negative2: "summary-card--negative2",
  warning: "summary-card--warning",
  neutral: "summary-card--neutral",
  dark: "summary-card--dark",
};

/**
 * `value` puede ser un número (se anima con count-up) o un nodo ya armado
 * (ProgressBar/Gauge) para las cards "Fondo de emergencia" / "Salud financiera".
 * `pulse` marca que este valor cambió desde el último refresh — además de
 * volver a entrar (glass-in) y recontar, la card recibe un anillo de brillo
 * breve para que el ojo encuentre qué se actualizó.
 */
export function SummaryCard({ iconName, tone = "neutral", label, value, footer, delay = 0, onClick, pulse = false }) {
  const valueEl = h("p", { class: "summary-card__value" }, typeof value === "number" ? "$0" : null);

  const card = h(
    "div",
    {
      class: `summary-card glass glass-pressable glass-in ${TONE_CLASS[tone] || ""}${pulse ? " summary-card--pulse" : ""}`,
      style: `--d:${delay}`,
      onClick,
      tabIndex: onClick ? 0 : undefined,
    },
    [
      h("span", { class: "summary-card__icon" }, [Icon(iconName, { size: 18 })]),
      h("p", { class: "summary-card__label" }, label),
      typeof value === "number" ? valueEl : value,
      footer ? h("div", { class: "summary-card__footer" }, footer) : null,
    ]
  );

  if (typeof value === "number") {
    requestAnimationFrame(() => animateNumber(valueEl, value, { duration: 900, format: fmt }));
  }

  return card;
}
