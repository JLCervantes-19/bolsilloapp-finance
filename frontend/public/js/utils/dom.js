/**
 * Helper mínimo de creación de DOM — no es un framework, es azúcar sobre
 * document.createElement para que los componentes en /components lean como
 * funciones declarativas sin traer React/Vue/etc.
 */
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "html") el.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key.startsWith("data-")) el.setAttribute(key, value);
    else if (key in el) el[key] = value;
    else el.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function mount(parent, el) {
  clear(parent);
  parent.appendChild(el);
  return el;
}
