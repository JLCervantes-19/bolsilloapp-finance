import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";
import { PocketPanel } from "./PocketPanel.js";

// Herramientas de finanzas personales (del bolsillo personal predeterminado).
const PERSONAL_LINKS = [
  { label: "Deudas", icon: "card", route: "#/deudas" },
  { label: "Ahorros y metas", icon: "piggy", route: "#/ahorros" },
  { label: "Analítica", icon: "pie", route: "#/analitica" },
];

const COLLAPSE_KEY = "bolsillo.sidebarCollapsed";
export const isSidebarCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Sidebar de escritorio (≥1080px): marca, panel de bolsillos (selector y
 * filtro principal), herramientas personales y "Agregar". Colapsable a una
 * columna de íconos; el estado se recuerda en este dispositivo.
 */
export function Sidebar({ activeRoute, onAddClick, onAddPocket, onEditPocket, onToggle }) {
  const collapsed = isSidebarCollapsed();
  const panel = PocketPanel({ compact: collapsed, onAdd: onAddPocket, onEdit: onEditPocket });

  const aside = h("aside", { class: `sidebar glass${collapsed ? " sidebar--collapsed" : ""}` }, [
    h("div", { class: "sidebar__top" }, [
      collapsed ? null : h("div", { class: "sidebar__brand" }, [h("span", {}, "bolsillo"), h("span", { class: "sidebar__brand-dot" }, ".")]),
      h("button", {
        type: "button",
        class: "sidebar__collapse",
        "aria-label": collapsed ? "Expandir panel" : "Colapsar panel",
        title: collapsed ? "Expandir panel" : "Colapsar panel",
        onClick: () => {
          try {
            localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
          } catch {
            // sin almacenamiento: solo cambia en esta vista
          }
          onToggle?.();
        },
      }, [Icon("sidebar", { size: 18 })]),
    ]),
    h("div", { class: "sidebar__scroll no-scrollbar" }, [
      panel,
      h("nav", { class: "sidebar__nav", "aria-label": "Finanzas personales" }, [
        collapsed ? null : h("p", { class: "pocket-panel__label" }, "Finanzas personales"),
        ...PERSONAL_LINKS.map((link) =>
          h("a", { href: link.route, class: `sidebar__link${activeRoute === link.route ? " sidebar__link--active" : ""}`, title: collapsed ? link.label : undefined }, [
            Icon(link.icon, { size: 18 }),
            collapsed ? null : h("span", {}, link.label),
          ])
        ),
      ]),
    ]),
    h("button", { type: "button", class: "btn btn--primary w-full sidebar__add", onClick: onAddClick, "aria-label": "Agregar movimiento" }, [
      Icon("plus", { size: 18 }),
      collapsed ? null : h("span", {}, "Agregar"),
    ]),
  ]);
  aside.refreshPockets = () => panel.refresh();
  return aside;
}
