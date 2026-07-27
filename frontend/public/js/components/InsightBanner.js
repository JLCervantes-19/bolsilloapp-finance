import { h } from "../utils/dom.js";

const TONE_CLASS = { positive: "insight--positive", warning: "insight--warning", negative: "insight--negative" };

export function InsightBanner({ tone = "positive", text, delay = 0 }) {
  return h("div", { class: `insight glass glass-in ${TONE_CLASS[tone] || ""}`, style: `--d:${delay}` }, text);
}
