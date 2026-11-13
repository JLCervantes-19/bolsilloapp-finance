import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";
import { fmtMoney, fmtDateShort } from "../utils/formatters.js";
import { findPocket } from "../services/pocketState.js";

export const TIPO_LABEL = { ingreso: "Ingreso", gasto: "Gasto", aporte: "Inversión", retiro: "Retiro", traslado: "Traslado" };
const TIPO_ICON = { ingreso: "in", gasto: "out", aporte: "trend", retiro: "wallet", traslado: "swap" };

const pocketName = (id) => {
  const p = findPocket(id);
  return p ? `${p.icon} ${p.name}` : null;
};

/**
 * Fila del historial unificado (vista `movimientos`). `showPocket` agrega la
 * etiqueta del bolsillo (consolidado). En el consolidado una transferencia
 * interna se muestra una sola vez y en neutro: no es ingreso ni gasto.
 */
export function MovementRow(m, { showPocket = false, onClick, delay = 0 } = {}) {
  const pocket = findPocket(m.bolsillo_id);
  const isTransfer = m.origen === "transferencias";
  const internal = isTransfer && m.contraparte_bolsillo_id;
  const neutral = showPocket && internal;

  const title = m.descripcion || (m.tipo === "gasto" && pocket?.kind === "business" ? "Egreso" : TIPO_LABEL[m.tipo]);
  const parts = [];
  if (isTransfer) {
    const other = pocketName(m.contraparte_bolsillo_id);
    const here = pocketName(m.bolsillo_id);
    if (neutral) parts.push(`${TIPO_LABEL[m.tipo]} · ${m.direccion === "salida" ? `${here} → ${other}` : `${other} → ${here}`}`);
    else if (m.direccion === "entrada") parts.push(`${TIPO_LABEL[m.tipo]} · desde ${other || "fuera de Bolsillo"}`);
    else parts.push(`${TIPO_LABEL[m.tipo]} · hacia ${other || "fuera de Bolsillo"}`);
  } else {
    parts.push(m.categoria_nombre || "Sin categoría");
  }
  if (m.metodo_pago) parts.push(m.metodo_pago);
  parts.push(fmtDateShort(m.fecha));

  const sign = neutral ? "" : m.direccion === "entrada" ? "+" : "-";
  const tone = neutral ? "tx-row__amount--neutral" : m.direccion === "entrada" ? "tx-row__amount--in" : "";

  return h(
    onClick ? "button" : "div",
    { type: onClick ? "button" : undefined, class: `tx-row glass-in${onClick ? " tx-row--button" : ""}`, style: `--d:${delay}`, onClick },
    [
      h("div", { class: "flex items-center gap-3", style: "min-width:0" }, [
        isTransfer
          ? h("span", { class: "tx-row__badge" }, [Icon(TIPO_ICON[m.tipo], { size: 14 })])
          : h("span", { style: `width:10px;height:10px;border-radius:50%;background:${m.categoria_color || "#787774"};flex:none;margin:0 3px` }),
        h("div", { style: "min-width:0;text-align:left" }, [
          h("p", { class: "tx-row__note" }, title),
          h("p", { class: "tx-row__meta" }, [
            showPocket && pocket ? h("span", { class: "pocket-tag", style: `--pc:${pocket.color}` }, `${pocket.icon} ${pocket.name}`) : null,
            parts.join(" · "),
          ]),
        ]),
      ]),
      h("span", { class: `tx-row__amount ${tone}` }, sign + fmtMoney(m.monto, pocket?.currency)),
    ]
  );
}
