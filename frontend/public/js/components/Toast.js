import { h } from "../utils/dom.js";

let container = null;
let timer = null;

function getContainer() {
  if (!container) {
    container = h("div", { class: "toast-root" });
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(text) {
  const root = getContainer();
  root.innerHTML = "";
  const toast = h("div", { class: "toast glass-strong" }, text);
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast--visible"));

  clearTimeout(timer);
  timer = setTimeout(() => {
    toast.classList.remove("toast--visible");
    setTimeout(() => toast.remove(), 220);
  }, 2600);
}
