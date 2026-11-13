import { h, mount, clear } from "./utils/dom.js";
import { registerRoute, startRouter, currentRoute, navigate } from "./router.js";
import { authService } from "./services/auth.js";
import { Sidebar } from "./components/Sidebar.js";
import { BottomNav } from "./components/BottomNav.js";
import { createBottomSheet } from "./components/BottomSheet.js";
import { PocketPanel } from "./components/PocketPanel.js";
import { PocketBar } from "./components/PocketBar.js";
import { PocketTabs } from "./components/PocketTabs.js";
import { PocketForm } from "./components/PocketForm.js";
import { QuickAddForm, clearCategoryCache } from "./pages/QuickAddForm.js";
import { renderHome } from "./pages/Home.js";
import { renderLogin } from "./pages/Login.js";
import { renderGastos, renderIngresos } from "./pages/Gastos.js";
import { renderDeudas } from "./pages/Deudas.js";
import { renderAhorros } from "./pages/Ahorros.js";
import { renderAnalitica } from "./pages/Analitica.js";
import { renderMovimientos, renderInversion, renderRetiros } from "./pages/Movimientos.js";
import { showToast } from "./components/Toast.js";
import { promptUsername, showRecoveryCode } from "./components/RecoveryCode.js";
import { api } from "./services/api.js";
import { ALL, activePocket, defaultPocket, isAll, loadPockets, pocketForForms, setActivePocket } from "./services/pocketState.js";
import { store } from "./store/store.js";

const root = document.getElementById("app");
const isDesktop = () => window.matchMedia("(min-width: 1080px)").matches;
const sheet = createBottomSheet();

// Rutas que se filtran por el bolsillo activo (muestran las pestañas internas).
const POCKET_ROUTES = ["#/dashboard", "#/ingresos", "#/gastos", "#/inversion", "#/retiros", "#/movimientos"];
const BUSINESS_ONLY = ["#/inversion", "#/retiros"];
// Tipo con el que abre el formulario según la pestaña donde está el usuario.
const MODE_BY_ROUTE = { "#/ingresos": "income", "#/gastos": "expense", "#/inversion": "aporte", "#/retiros": "retiro" };

const rerender = () => window.dispatchEvent(new Event("hashchange"));
const refreshData = () => window.dispatchEvent(new CustomEvent("bolsillo:refresh"));

function openQuickAdd() {
  const route = currentRoute();
  const pocket = pocketForForms();
  if (!pocket) return showToast("Todavía se están cargando tus bolsillos");
  const mode = MODE_BY_ROUTE[route] || (pocket.kind === "business" ? "income" : "expense");
  sheet.open(
    "Agregar movimiento",
    QuickAddForm({
      pocketId: pocket.id,
      mode,
      onDone: () => {
        setTimeout(() => sheet.close(), 500);
        refreshData();
      },
    })
  );
}

async function afterPocketChange(result) {
  sheet.close();
  if (!result?.changed) return;
  clearCategoryCache();
  await loadPockets({ force: true }).catch(() => {});
  if (result.created) return setActivePocket(result.created.id);
  if (result.deleted && store.state.activePocketId === result.deleted) return setActivePocket(defaultPocket()?.id || ALL);
  rerender();
}

function openPocketForm(pocket = null) {
  sheet.open(pocket ? "Editar bolsillo" : "Nuevo bolsillo", PocketForm({ pocket, onDone: afterPocketChange }));
}

function openPocketSheet() {
  sheet.open(
    "Tus bolsillos",
    PocketPanel({ onAdd: () => openPocketForm(), onEdit: (p) => openPocketForm(p), onSelected: () => sheet.close() })
  );
}

let chrome = { sidebar: null, bar: null };

function AppShell(pageEl, activeRoute) {
  const pocket = activePocket();
  const color = pocket?.color || "#14161f";
  const tabs = POCKET_ROUTES.includes(activeRoute) ? PocketTabs({ pocket, activeRoute }) : null;

  if (isDesktop()) {
    chrome.sidebar = Sidebar({ activeRoute, onAddClick: openQuickAdd, onAddPocket: () => openPocketForm(), onEditPocket: openPocketForm, onToggle: rerender });
    chrome.bar = null;
    const content = h("main", { class: "app-main" }, [tabs, pageEl]);
    return h("div", { class: "app-shell app-shell--desktop", style: `--pocket-color:${color}` }, [h("div", { class: "pocket-strip", "aria-hidden": "true" }), chrome.sidebar, content]);
  }
  chrome.sidebar = null;
  chrome.bar = h("div", { class: "pocket-bar-slot" }, [PocketBar({ pocket: isAll() ? null : pocket, onOpen: openPocketSheet })]);
  const content = h("main", { class: "app-main" }, [chrome.bar, tabs, pageEl]);
  return h("div", { class: "app-shell", style: `--pocket-color:${color}` }, [h("div", { class: "pocket-strip", "aria-hidden": "true" }), content, BottomNav({ activeRoute, onFabClick: openQuickAdd })]);
}

// Cuentas creadas con correo (antes de quitar los correos): eligen usuario
// y reciben su código de recuperación antes de seguir usando la app.
let claiming = null;
function ensureUsername() {
  if (!authService.needsUsername()) return Promise.resolve();
  claiming ??= promptUsername((value) => api.post("/auth/claim-username", { username: value.trim().toLowerCase() }), {
    onLogout: async () => {
      await authService.logout();
      navigate("/login");
    },
  })
    .then(async (result) => {
      if (!result) return; // cerró sesión o venció: ya se mandó al login
      authService.setUsername(result.username);
      // null = ya lo había elegido en otro dispositivo (su código ya se mostró allá).
      if (result.recovery_code) await showRecoveryCode(result.recovery_code, { username: result.username });
    })
    .finally(() => {
      claiming = null;
    });
  return claiming;
}

function guardedRoute(renderFn) {
  return async (ctx) => {
    if (!authService.isAuthenticated()) {
      navigate("/login");
      return;
    }
    await ensureUsername();
    if (!authService.isAuthenticated()) return;
    try {
      await loadPockets();
    } catch (err) {
      clear(root);
      root.appendChild(h("div", { class: "app-main" }, [h("p", { style: "color:var(--text-secondary)" }, `No se pudieron cargar tus bolsillos: ${err.message}`)]));
      return;
    }
    const route = currentRoute();
    if (BUSINESS_ONLY.includes(route) && activePocket()?.kind !== "business") {
      navigate("/dashboard");
      return;
    }
    const pageEl = h("div", { class: "page-loading" }, [h("div", { class: "skeleton", style: "height:160px;border-radius:24px" })]);
    mount(root, AppShell(pageEl, route));
    return renderFn(pageEl, { ...ctx, pocket: isAll() ? null : activePocket(), all: isAll() });
  };
}

registerRoute("/login", async () => {
  clear(root);
  root.appendChild(renderLogin({ onSuccess: () => navigate("/dashboard") }));
});

registerRoute("/dashboard", guardedRoute(renderHome));
registerRoute("/ingresos", guardedRoute(renderIngresos));
registerRoute("/gastos", guardedRoute(renderGastos));
registerRoute("/inversion", guardedRoute(renderInversion));
registerRoute("/retiros", guardedRoute(renderRetiros));
registerRoute("/movimientos", guardedRoute(renderMovimientos));
registerRoute("/deudas", guardedRoute(renderDeudas));
registerRoute("/ahorros", guardedRoute(renderAhorros));
registerRoute("/analitica", guardedRoute(renderAnalitica));

registerRoute("/not-found", async () => navigate("/dashboard"));

// Cambiar de bolsillo vuelve a pintar la ruta actual filtrada por el nuevo
// (o vuelve al Resumen si la pestaña no existe para ese tipo de bolsillo).
window.addEventListener("bolsillo:pocket-change", () => {
  const route = currentRoute();
  if (BUSINESS_ONLY.includes(route) && activePocket()?.kind !== "business") navigate("/dashboard");
  else rerender();
});

// Después de registrar un movimiento: recargar saldos del panel sin
// reconstruir la página (cada página escucha bolsillo:refresh por su cuenta).
window.addEventListener("bolsillo:refresh", async () => {
  try {
    await loadPockets({ force: true });
  } catch {
    return;
  }
  chrome.sidebar?.refreshPockets();
  if (chrome.bar) {
    const p = activePocket();
    chrome.bar.replaceChildren(PocketBar({ pocket: isAll() ? null : p, onOpen: openPocketSheet }));
  }
});

// Re-render del shell (sidebar <-> bottom-nav) SOLO al cruzar el breakpoint
// desktop/mobile real — nunca en cualquier resize. En Safari iOS, hacer
// scroll cambia la altura del viewport (la barra de URL se esconde/muestra)
// y eso dispara "resize" todo el tiempo; sin este guard, la página entera
// se reconstruía (refetch + replay de todas las animaciones de entrada) en
// cada scroll, lo que se sentía como que la app "se actualizaba sola".
let lastIsDesktop = isDesktop();
window.addEventListener("resize", () => {
  clearTimeout(window.__resizeT);
  window.__resizeT = setTimeout(() => {
    const nowDesktop = isDesktop();
    if (nowDesktop === lastIsDesktop) return;
    lastIsDesktop = nowDesktop;
    rerender();
  }, 150);
});

authService.restoreSession();
startRouter();

