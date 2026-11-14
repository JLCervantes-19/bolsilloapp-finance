import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";
import { fmtMoney } from "../utils/formatters.js";
import { KIND_LABEL, pockets } from "../services/pocketState.js";

/**
 * Móvil: botón del bolsillo actual dentro de la barra inferior (al alcance
 * del pulgar). Muestra su ícono con el color del bolsillo y abre la hoja
 * inferior con la lista completa.
 */
export function PocketBar({ pocket, onOpen }) {
  const total = pockets().reduce((s, p) => s + (Number(p.metrics?.saldo) || 0), 0);
  const label = pocket ? pocket.name : "Todo / Consolidado";
  const meta = pocket ? `${KIND_LABEL[pocket.kind]}, ${fmtMoney(pocket.metrics?.saldo, pocket.currency)}` : `Patrimonio, ${fmtMoney(total)}`;
  return h(
    "button",
    { type: "button", class: "pocket-nav-btn", onClick: onOpen, "aria-label": `Bolsillo actual: ${label} (${meta}). Cambiar de bolsillo`, title: label },
    [h("span", { class: "pocket-nav-btn__icon", "aria-hidden": "true" }, pocket ? pocket.icon : [Icon("layers", { size: 18 })])]
  );
}
