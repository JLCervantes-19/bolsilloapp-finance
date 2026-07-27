import { h } from "../utils/dom.js";

export function ProgressBar({ percent, label, color = "var(--brand-accent)" }) {
  const fill = h("div", { class: "progress-bar__fill", style: `width:0%; background:${color}` });
  const bar = h("div", { class: "progress-bar" }, [
    h("div", { class: "progress-bar__track" }, [fill]),
    label ? h("p", { class: "progress-bar__label" }, label) : null,
  ]);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    });
  });
  return bar;
}
