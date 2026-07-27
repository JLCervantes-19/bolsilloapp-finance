import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";

/**
 * `direction` controla solo la flecha (arriba/abajo, el movimiento real del
 * número). `positive` controla el color — son independientes a propósito:
 * en "Ingresos" que suba es bueno (verde), pero en "Gastos" que suba es
 * malo (rojo) aunque la flecha en ambos casos apunte "arriba". Pasar
 * siempre `positive` explícito en vez de asumirlo desde `direction`.
 */
export function ChangeIndicator({ direction, positive = direction === "up", label, muted = false }) {
  if (muted) return h("span", { class: "change-indicator change-indicator--muted" }, label);
  const tone = positive ? "positive" : "negative";
  return h("span", { class: `change-indicator change-indicator--${tone}` }, [Icon(direction, { size: 12 }), h("span", {}, label)]);
}
