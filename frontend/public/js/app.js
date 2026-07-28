import { h, mount, clear } from "./utils/dom.js";
import { registerRoute, startRouter, currentRoute, navigate } from "./router.js";
import { store } from "./store/store.js";
import { authService } from "./services/auth.js";
import { financialService } from "./services/financialService.js";
import { Sidebar } from "./components/Sidebar.js";
import { BottomNav } from "./components/BottomNav.js";
import { createBottomSheet } from "./components/BottomSheet.js";
import { QuickAddForm } from "./pages/QuickAddForm.js";
import { renderDashboard } from "./pages/Dashboard.js";
import { renderLogin } from "./pages/Login.js";
import { renderResetPassword } from "./pages/ResetPassword.js";
import { renderGastos } from "./pages/Gastos.js";
import { renderDeudas } from "./pages/Deudas.js";
import { renderAhorros } from "./pages/Ahorros.js";
import { renderAnalitica } from "./pages/Analitica.js";
import { showToast } from "./components/Toast.js";

const root = document.getElementById("app");
const isDesktop = () => window.matchMedia("(min-width: 1080px)").matches;
const quickAddSheet = createBottomSheet();

async function openQuickAdd() {
  let categories = store.state.categories;
  if (!categories.length) {
    categories = await financialService.listCategories();
    store.setState({ categories });
  }
  quickAddSheet.open(
    "Agregar movimiento",
    QuickAddForm({
      categories,
      onDone: () => {
        setTimeout(() => quickAddSheet.close(), 500);
        window.dispatchEvent(new CustomEvent("bolsillo:refresh"));
      },
    })
  );
}

function AppShell(pageEl, activeRoute) {
  const content = h("main", { class: "app-main" }, [pageEl]);
  if (isDesktop()) {
    return h("div", { class: "app-shell app-shell--desktop" }, [Sidebar({ activeRoute, onAddClick: openQuickAdd }), content]);
  }
  return h("div", { class: "app-shell" }, [content, BottomNav({ activeRoute, onFabClick: openQuickAdd })]);
}

function renderShell(pageEl) {
  mount(root, AppShell(pageEl, currentRoute()));
}

function guardedRoute(renderFn) {
  return async (ctx) => {
    if (!authService.isAuthenticated()) {
      navigate("/login");
      return;
    }
    const pageEl = h("div", { class: "page-loading" }, [h("div", { class: "skeleton", style: "height:160px;border-radius:24px" })]);
    renderShell(pageEl);
    return renderFn(pageEl, ctx);
  };
}

registerRoute("/login", async () => {
  clear(root);
  root.appendChild(renderLogin({ onSuccess: () => navigate("/dashboard") }));
});

registerRoute("/reset-password", async () => {
  clear(root);
  root.appendChild(renderResetPassword({ onSuccess: () => navigate("/login") }));
});

registerRoute("/dashboard", guardedRoute(renderDashboard));
registerRoute("/gastos", guardedRoute(renderGastos));
registerRoute("/deudas", guardedRoute(renderDeudas));
registerRoute("/ahorros", guardedRoute(renderAhorros));
registerRoute("/analitica", guardedRoute(renderAnalitica));

registerRoute("/not-found", async () => navigate("/dashboard"));

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
    window.dispatchEvent(new Event("hashchange"));
  }, 150);
});

const authRedirect = authService.handleAuthRedirect();
if (!authRedirect.handled) authService.restoreSession();
startRouter();
if (authRedirect.handled && authRedirect.type !== "recovery") {
  showToast("¡Correo confirmado! Ya iniciaste sesión.");
}
