/**
 * Router SPA sobre History API — usa hash routes (#/dashboard) para poder
 * servirse como archivos estáticos sin configurar rewrites en el host;
 * `public/index.html` es el único fallback real que hace falta.
 */
const routes = new Map();
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

async function render() {
  const path = window.location.hash.slice(1) || "/dashboard";
  const [route] = path.split("?");
  const handler = routes.get(route) || routes.get("/not-found");
  if (!handler) return;

  if (typeof currentCleanup === "function") currentCleanup();
  currentCleanup = await handler({ path, query: new URLSearchParams(path.split("?")[1] || "") });
}

export function startRouter() {
  window.addEventListener("hashchange", render);
  render();
}

export function currentRoute() {
  return "#" + (window.location.hash.slice(1) || "/dashboard").split("?")[0];
}

export function navigate(path) {
  window.location.hash = path;
}
