import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";

const LINKS = [
  { label: "Resumen", icon: "home", route: "#/dashboard" },
  { label: "Gastos", icon: "out", route: "#/gastos" },
  { label: "Deudas", icon: "card", route: "#/deudas" },
  { label: "Ahorros y metas", icon: "piggy", route: "#/ahorros" },
  { label: "Analítica", icon: "pie", route: "#/analitica" },
];

export function Sidebar({ activeRoute, onAddClick }) {
  return h("aside", { class: "sidebar glass" }, [
    h("div", { class: "sidebar__brand" }, [h("span", {}, "bolsillo"), h("span", { class: "sidebar__brand-dot" }, ".")]),
    h(
      "nav",
      { class: "sidebar__nav" },
      LINKS.map((link) =>
        h("a", { href: link.route, class: `sidebar__link${activeRoute === link.route ? " sidebar__link--active" : ""}` }, [
          Icon(link.icon, { size: 18 }),
          h("span", {}, link.label),
        ])
      )
    ),
    h("button", { type: "button", class: "btn btn--primary w-full", onClick: onAddClick }, [Icon("plus", { size: 18 }), h("span", {}, "Agregar")]),
  ]);
}
