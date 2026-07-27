import { h } from "../utils/dom.js";

/** Input grande de monto — se sacude (shake) si se envía vacío/inválido. */
export function AmountField({ value = "", onChange }) {
  const input = h("input", {
    type: "number",
    inputMode: "decimal",
    placeholder: "0",
    class: "amount-field glass",
    value,
    onInput: (e) => onChange?.(e.target.value),
  });
  return input;
}

export function shakeField(el) {
  el.classList.remove("amount-field--shake");
  // eslint-disable-next-line no-unused-expressions
  void el.offsetWidth;
  el.classList.add("amount-field--shake");
}
