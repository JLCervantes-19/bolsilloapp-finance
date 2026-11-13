import { h } from "../utils/dom.js";
import { tabsFor } from "../services/pocketState.js";

/** Segunda capa de pestañas: subdivide la operación del bolsillo activo. */
export function PocketTabs({ pocket, activeRoute }) {
  return h(
    "nav",
    { class: "pocket-tabs no-scrollbar", "aria-label": "Secciones del bolsillo" },
    tabsFor(pocket).map((t) =>
      h("a", { href: t.route, class: `pocket-tabs__tab${activeRoute === t.route ? " pocket-tabs__tab--active" : ""}`, "aria-current": activeRoute === t.route ? "page" : undefined }, t.label)
    )
  );
}
