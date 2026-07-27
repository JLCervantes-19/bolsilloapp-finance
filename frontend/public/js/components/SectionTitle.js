import { h } from "../utils/dom.js";

export function SectionTitle({ label, meta }) {
  return h("div", { class: "section-title" }, [h("span", {}, label), meta ? h("span", { class: "section-title__meta" }, meta) : null]);
}
