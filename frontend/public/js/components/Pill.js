import { h } from "../utils/dom.js";
import { Icon } from "./Icon.js";

export function Pill({ label, chevron = false, onClick }) {
  return h("button", { type: "button", class: "pill glass glass-pressable", onClick }, [
    h("span", {}, label),
    chevron ? Icon("chevron", { size: 14 }) : null,
  ]);
}
