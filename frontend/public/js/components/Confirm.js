import { h } from "../utils/dom.js";
import { Button } from "./Button.js";

/**
 * Diálogo de confirmación genérico — se monta/desmonta en <body> por
 * llamada (a diferencia de BottomSheet, no hay una sola instancia
 * reutilizada) porque puede dispararse desde cualquier página o formulario
 * sin que ese módulo tenga que crear/gestionar su propio sheet.
 *
 * Uso: `if (!(await confirmAction({ title, message }))) return;`
 */
export function confirmAction({ title = "¿Estás seguro?", message = "", confirmLabel = "Confirmar", cancelLabel = "Cancelar", danger = false } = {}) {
  return new Promise((resolve) => {
    let overlay;

    const close = (result) => {
      overlay.classList.remove("confirm-overlay--open");
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    const confirmBtn = Button({ label: confirmLabel, variant: danger ? "danger" : "primary", onClick: () => close(true) });
    const cancelBtn = Button({ label: cancelLabel, variant: "ghost", onClick: () => close(false) });

    const card = h(
      "div",
      { class: "confirm-card glass-strong glass-in" },
      [
        h("h3", { class: "confirm-card__title" }, title),
        message ? h("p", { class: "confirm-card__message" }, message) : null,
        h("div", { class: "flex gap-2", style: "justify-content:flex-end;margin-top:var(--space-4)" }, [cancelBtn, confirmBtn]),
      ]
    );

    overlay = h(
      "div",
      { class: "confirm-overlay", onClick: (e) => (e.target === overlay ? close(false) : null) },
      [card]
    );

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("confirm-overlay--open"));
  });
}
