import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";

export function IconButton({ iconName, onClick, dot = false, ariaLabel }) {
  return h("button", { type: "button", class: "icon-btn glass glass-pressable", onClick, "aria-label": ariaLabel || iconName }, [
    Icon(iconName, { size: 19 }),
    dot ? h("span", { class: "icon-btn__dot" }) : null,
  ]);
}
