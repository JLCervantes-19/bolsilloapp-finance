import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";

const VARIANT_CLASS = {
  primary: "btn btn--primary",
  secondary: "btn btn--secondary",
  ghost: "btn btn--ghost",
  danger: "btn btn--danger",
};

/**
 * Button — 8 estados: default · hover · focus-visible · active · disabled ·
 * loading · error · success (loading/error/success vía setButtonState()).
 */
export function Button({ label, variant = "primary", iconName, fullWidth = false, type = "button", onClick, disabled = false }) {
  const btn = h(
    "button",
    {
      type,
      class: `${VARIANT_CLASS[variant] || VARIANT_CLASS.primary}${fullWidth ? " w-full" : ""}`,
      onClick,
      disabled,
    },
    [iconName ? Icon(iconName, { size: 18 }) : null, h("span", { class: "btn__label" }, label)]
  );
  return btn;
}

export function setButtonState(btn, state) {
  btn.dataset.state = state || "";
  btn.disabled = state === "loading" || state === "disabled";
}
