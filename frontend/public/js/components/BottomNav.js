import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";

const ITEMS = [
  { icon: "home", route: "#/dashboard" },
  { icon: "out", route: "#/gastos" },
  { icon: "card", route: "#/deudas" },
  { icon: "piggy", route: "#/ahorros" },
];

/** Nav flotante tipo pill (N5) con FAB integrado — el patrón menos genérico para mobile finance apps. */
export function BottomNav({ activeRoute, onFabClick }) {
  const nav = h(
    "nav",
    { class: "bottom-nav glass-strong glass-floating" },
    ITEMS.map((item, i) =>
      h("a", { href: item.route, class: `bottom-nav__item${activeRoute === item.route ? " bottom-nav__item--active" : ""}` }, [
        Icon(item.icon, { size: 20 }),
      ])
    )
  );
  const fab = h("button", { type: "button", class: "fab glass-strong glass-floating glass-pressable", onClick: onFabClick, "aria-label": "Agregar" }, [
    Icon("plus", { size: 24 }),
  ]);
  return h("div", { class: "bottom-nav-wrap" }, [nav, fab]);
}
