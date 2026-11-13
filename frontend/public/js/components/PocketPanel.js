import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";
import { fmtMoney } from "../utils/formatters.js";
import { ALL, pockets, setActivePocket, KIND_LABEL } from "../services/pocketState.js";
import { store } from "../store/store.js";

// Cuántos bolsillos se ven antes de "Ver todos": el resto queda en la lista
// con desplazamiento (nunca rompe el layout).
const VISIBLE = 5;
let expanded = false;
let showArchived = false;

function PocketRow({ pocket, active, compact, onSelect, onEdit }) {
  const row = h(
    "div",
    {
      class: `pocket-row${active ? " pocket-row--active" : ""}${pocket.archived_at ? " pocket-row--archived" : ""}`,
      style: `--pc:${pocket.color}`,
    },
    [
      h(
        "button",
        {
          type: "button",
          class: "pocket-row__main",
          onClick: () => onSelect(pocket.id),
          "aria-current": active ? "true" : undefined,
          title: compact ? `${pocket.name} · ${fmtMoney(pocket.metrics?.saldo, pocket.currency)}` : undefined,
        },
        [
          h("span", { class: "pocket-row__icon", "aria-hidden": "true" }, pocket.icon),
          compact
            ? null
            : h("span", { class: "pocket-row__text" }, [
                h("span", { class: "pocket-row__name" }, pocket.name),
                h("span", { class: "pocket-row__sub" }, [
                  h("span", { class: "pocket-row__meta" }, pocket.archived_at ? "Archivado" : KIND_LABEL[pocket.kind]),
                  h("span", { class: "pocket-row__balance" }, fmtMoney(pocket.metrics?.saldo, pocket.currency)),
                ]),
              ]),
        ]
      ),
      compact
        ? null
        : h(
            "button",
            { type: "button", class: "pocket-row__edit", "aria-label": `Editar ${pocket.name}`, title: "Editar bolsillo", onClick: () => onEdit(pocket) },
            [Icon("dots", { size: 16 })]
          ),
    ]
  );
  return row;
}

/**
 * Selector principal de la app: "Todo / Consolidado" fijo arriba, la lista
 * de bolsillos con ícono, color, nombre y saldo, y "+ Agregar bolsillo".
 * Se usa en el sidebar de escritorio (colapsable) y en la hoja de móvil.
 */
export function PocketPanel({ compact = false, onAdd, onEdit, onSelected } = {}) {
  const root = h("div", { class: `pocket-panel${compact ? " pocket-panel--compact" : ""}` });

  function select(id) {
    setActivePocket(id);
    onSelected?.(id);
  }

  function render() {
    root.replaceChildren();
    const list = pockets();
    const activeId = store.state.activePocketId;
    const live = list.filter((p) => !p.archived_at);
    const archived = list.filter((p) => p.archived_at);
    const total = live.reduce((s, p) => s + (Number(p.metrics?.saldo) || 0), 0) + archived.reduce((s, p) => s + (Number(p.metrics?.saldo) || 0), 0);

    if (!compact) root.append(h("p", { class: "pocket-panel__label" }, "Bolsillos"));

    root.append(
      h("button", {
        type: "button",
        class: `pocket-row pocket-row--all${activeId === ALL ? " pocket-row--active" : ""}`,
        style: "--pc:var(--ink)",
        onClick: () => select(ALL),
        title: compact ? `Todo / Consolidado · ${fmtMoney(total)}` : undefined,
      }, [
        h("span", { class: "pocket-row__main" }, [
          h("span", { class: "pocket-row__icon pocket-row__icon--all", "aria-hidden": "true" }, [Icon("layers", { size: 16 })]),
          compact
            ? null
            : h("span", { class: "pocket-row__text" }, [
                h("span", { class: "pocket-row__name" }, "Todo / Consolidado"),
                h("span", { class: "pocket-row__sub" }, [
                  h("span", { class: "pocket-row__meta" }, `${list.length} ${list.length === 1 ? "bolsillo" : "bolsillos"}`),
                  h("span", { class: "pocket-row__balance" }, fmtMoney(total)),
                ]),
              ]),
        ]),
      ])
    );

    const shown = compact || expanded ? live : live.slice(0, VISIBLE);
    root.append(
      h(
        "div",
        { class: `pocket-panel__list no-scrollbar${expanded ? " pocket-panel__list--expanded" : ""}` },
        shown.map((p) => PocketRow({ pocket: p, active: p.id === activeId, compact, onSelect: select, onEdit }))
      )
    );

    if (!compact && live.length > VISIBLE) {
      root.append(
        h("button", { type: "button", class: "pocket-panel__more", onClick: () => ((expanded = !expanded), render()) },
          expanded ? "Ver menos" : `Ver todos (${live.length})`)
      );
    }

    if (!compact && archived.length) {
      root.append(
        h("button", { type: "button", class: "pocket-panel__more", onClick: () => ((showArchived = !showArchived), render()) },
          showArchived ? "Ocultar archivados" : `Archivados (${archived.length})`)
      );
      if (showArchived) {
        root.append(h("div", { class: "pocket-panel__list" }, archived.map((p) => PocketRow({ pocket: p, active: p.id === activeId, compact, onSelect: select, onEdit }))));
      }
    }

    if (!compact && live.length === 1) {
      root.append(h("p", { class: "pocket-panel__hint" }, "¿Tenés un negocio? Creá un bolsillo para separar su dinero del tuyo."));
    }

    root.append(
      h("button", { type: "button", class: `pocket-panel__add${compact ? " pocket-panel__add--compact" : ""}`, onClick: onAdd, "aria-label": "Agregar bolsillo", title: "Agregar bolsillo" }, [
        Icon("plus", { size: 16 }),
        compact ? null : h("span", {}, "Agregar bolsillo"),
      ])
    );
  }

  render();
  root.refresh = render;
  return root;
}
