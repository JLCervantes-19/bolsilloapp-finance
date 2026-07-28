import { API_BASE_URL } from "./config.js";
import { store } from "../store/store.js";

const STORAGE_KEY = "bolsillo.session";

async function request(path, body) {
  const res = await fetch(`${API_BASE_URL}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || "Error de autenticación");
  return json.data;
}

function persistSession(session) {
  store.setState({ session });
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

export const authService = {
  async signup(email, password, fullName) {
    const data = await request("signup", { email, password, full_name: fullName });
    if (data.session) persistSession(data.session);
    return data;
  },

  async login(email, password) {
    const data = await request("login", { email, password });
    persistSession(data.session);
    return data;
  },

  async logout() {
    const session = store.state.session;
    persistSession(null);
    if (session?.access_token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }
  },

  // Supabase redirige tanto el link de confirmación de correo como el de
  // "restablecer contraseña" a esta misma app con
  // `#access_token=...&refresh_token=...&type=signup|recovery` en el
  // fragmento — el router hash-based no reconoce eso como ruta y cae en
  // /not-found (por eso "no salía nada"). Hay que interceptarlo ANTES de que
  // arranque el router, y mandar cada `type` a un destino distinto: signup
  // entra directo al dashboard, recovery va a la pantalla de nueva contraseña.
  handleAuthRedirect() {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    if (!hash.includes("access_token=")) return { handled: false };

    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type"); // "signup" | "recovery" | "email_change" | ...
    if (!access_token) return { handled: false };

    persistSession({ access_token, refresh_token });
    const target = type === "recovery" ? "/reset-password" : "/dashboard";
    window.history.replaceState(null, "", window.location.pathname + window.location.search + `#${target}`);
    return { handled: true, type };
  },

  async requestPasswordReset(email) {
    return request("forgot-password", { email });
  },

  async resetPassword(password) {
    const session = store.state.session;
    if (!session?.access_token || !session?.refresh_token) {
      throw new Error("El link de recuperación expiró — pedí uno nuevo.");
    }
    await request("reset-password", { access_token: session.access_token, refresh_token: session.refresh_token, password });
    persistSession(null); // fuerza a loguearse de nuevo ya con la contraseña nueva
  },

  restoreSession() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw);
      store.setState({ session });
      return session;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  },

  isAuthenticated() {
    return Boolean(store.state.session?.access_token);
  },
};
