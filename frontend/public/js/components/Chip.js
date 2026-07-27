import { h } from "../utils/dom.js";

/** Chip seleccionable — invierte a relleno sólido del color dado cuando `pressed`. */
export function Chip({ label, color = "var(--brand-accent)", pressed = false, onClick }) {
  const chip = h(
    "button",
    {
      type: "button",
      class: `chip glass glass-pressable${pressed ? " chip--pressed" : ""}`,
      "aria-pressed": String(pressed),
      onClick,
    },
    label
  );
  if (pressed) {
    chip.style.setProperty("--chip-color", color);
  }
  return chip;
}
