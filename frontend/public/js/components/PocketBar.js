import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";
import { fmtMoney } from "../utils/formatters.js";
import { KIND_LABEL, pockets } from "../services/pocketState.js";

/**
 * Móvil: muestra en qué bolsillo estás y abre la hoja inferior con la lista
 * completa (alcanzable con una mano).
 */
export function PocketBar({ pocket, onOpen }) {
  const total = pockets().reduce((s, p) => s + (Number(p.metrics?.saldo) || 0), 0);
  const label = pocket ? pocket.name : "Todo / Consolidado";
  const meta = pocket ? `${KIND_LABEL[pocket.kind]} · ${fmtMoney(pocket.metrics?.saldo, pocket.currency)}` : `Patrimonio · ${fmtMoney(total)}`;
  return h("button", { type: "button", class: "pocket-bar glass glass-pressable", onClick: onOpen, "aria-label": `Bolsillo actual: ${label}. Cambiar de bolsillo` }, [
    h("span", { class: "pocket-row__icon", "aria-hidden": "true" }, pocket ? pocket.icon : [Icon("layers", { size: 16 })]),
    h("span", { class: "pocket-row__text" }, [h("span", { class: "pocket-row__name" }, label), h("span", { class: "pocket-row__meta" }, meta)]),
    Icon("down", { size: 16 }),
  ]);
}
