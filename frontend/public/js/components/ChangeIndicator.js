import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";

export function ChangeIndicator({ direction, label, muted = false }) {
  if (muted) return h("span", { class: "change-indicator change-indicator--muted" }, label);
  const tone = direction === "up" ? "positive" : "negative";
  return h("span", { class: `change-indicator change-indicator--${tone}` }, [Icon(direction, { size: 12 }), h("span", {}, label)]);
}
