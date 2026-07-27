import { h, clear } from "../utils/dom.js";
import { Icon } from "./Icon.js";

/**
 * Bottom sheet reutilizable — vidrio fuerte, scrim al 45% detrás, anima con
 * --ease-drawer (más pesado que las entradas normales). `mount()` inserta
 * el nodo en <body> una sola vez; open()/close() solo alternan estado.
 */
export function createBottomSheet() {
  const titleEl = h("h2", { class: "sheet__title" });
  const bodyEl = h("div", { class: "sheet__body" });
  const closeBtn = h("button", { type: "button", class: "sheet__close icon-btn glass glass-pressable", "aria-label": "Cerrar" }, [
    Icon("x", { size: 18 }),
  ]);
  const panel = h("div", { class: "sheet__panel glass-strong glass-floating" }, [
    h("div", { class: "sheet__handle" }),
    h("div", { class: "sheet__header" }, [titleEl, closeBtn]),
    bodyEl,
  ]);
  const scrim = h("div", { class: "sheet__scrim" });
  const root = h("div", { class: "sheet-root" }, [scrim, panel]);
  document.body.appendChild(root);

  function close() {
    root.classList.remove("sheet-root--open");
    setTimeout(() => (root.style.pointerEvents = "none"), 380);
  }

  function open(title, contentNode) {
    titleEl.textContent = title;
    clear(bodyEl);
    bodyEl.appendChild(contentNode);
    root.style.pointerEvents = "auto";
    requestAnimationFrame(() => root.classList.add("sheet-root--open"));
  }

  scrim.addEventListener("click", close);
  closeBtn.addEventListener("click", close);

  return { open, close, root };
}
