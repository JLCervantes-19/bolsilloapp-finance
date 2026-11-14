import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";

const ITEMS = [
  { icon: "home", route: "#/dashboard", label: "Resumen" },
  { icon: "out", route: "#/gastos", label: "Gastos" },
  { icon: "card", route: "#/deudas", label: "Deudas" },
  { icon: "piggy", route: "#/ahorros", label: "Ahorros" },
];

/** Nav flotante tipo pill (N5) con FAB integrado — el patrón menos genérico para mobile finance apps. */
export function BottomNav({ activeRoute, onFabClick, pocketSlot }) {
  const nav = h("nav", { class: "bottom-nav glass-strong glass-floating", "aria-label": "Navegación principal" }, [
    // Selector de bolsillo primero, separado de las secciones.
    pocketSlot,
    pocketSlot ? h("span", { class: "bottom-nav__divider", "aria-hidden": "true" }) : null,
    ...ITEMS.map((item) =>
      h(
        "a",
        {
          href: item.route,
          class: `bottom-nav__item${activeRoute === item.route ? " bottom-nav__item--active" : ""}`,
          "aria-label": item.label,
          "aria-current": activeRoute === item.route ? "page" : undefined,
        },
        [Icon(item.icon, { size: 20 })]
      )
    ),
  ]);
  const fab = h("button", { type: "button", class: "fab glass-strong glass-floating glass-pressable", onClick: onFabClick, "aria-label": "Agregar" }, [
    Icon("plus", { size: 24 }),
  ]);
  return h("div", { class: "bottom-nav-wrap" }, [nav, fab]);
}
