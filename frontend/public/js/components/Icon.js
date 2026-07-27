import { h } from "../utils/dom.js";

/** `name` sin el prefijo "i-" (ver sprite en index.html), p.ej. Icon("home", { size: 20 }) */
export function Icon(name, { size = 20, class: cls = "" } = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("fill", "none");
  svg.setAttribute("class", cls);
  svg.style.flex = "none";
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.appendChild(use);
  return svg;
}

export function iconHTML(name) {
  return `<svg width="20" height="20" fill="none" style="flex:none"><use href="#i-${name}"></use></svg>`;
}
