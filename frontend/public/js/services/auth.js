import { API_BASE_URL } from "./config.js";
import { store } from "../store/store.js";
import { apiErrorMessage } from "../utils/errors.js";

const STORAGE_KEY = "onemillion.session";

// Migración del nombre anterior (Bolsillo): conserva la sesión y la
// preferencia del sidebar de quienes ya usaban la app.
for (const k of ["session", "sidebarCollapsed"]) {
  try {
    const old = localStorage.getItem(`bolsillo.${k}`);
    if (old !== null && localStorage.getItem(`onemillion.${k}`) === null) localStorage.setItem(`onemillion.${k}`, old);
    localStorage.removeItem(`bolsillo.${k}`);
  } catch {}
}

async function request(path, body) {
  const res = await fetch(`${API_BASE_URL}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(apiErrorMessage(json, "Error de autenticación"));
    err.status = res.status;
    throw err;
  }
  return json.data;
}

function persistSession(session) {
  store.setState({ session });
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

export const authService = {
  async signup(username, password, fullName, acceptedPrivacy) {
    const data = await request("signup", { username, password, full_name: fullName || undefined, accepted_privacy: acceptedPrivacy });
    if (data.session) persistSession(data.session);
    return data;
  },

  async login(username, password) {
    const data = await request("login", { username, password });
    persistSession(data.session);
    return data;
  },

  async refresh(refreshToken) {
    const data = await request("refresh", { refresh_token: refreshToken });
    persistSession(data.session);
    return data.session;
  },

  /** Limpia la sesión local sin llamar al backend (la cuenta ya no existe). */
  clearSession() {
    persistSession(null);
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

  /** Olvidé mi contraseña: usuario + código → sesión nueva y código nuevo. */
  async recover(username, recoveryCode, password) {
    const data = await request("recover", { username, recovery_code: recoveryCode, password });
    persistSession(data.session);
    return data;
  },

  /** Usuario con el que se entra (null en cuentas creadas con correo que aún no lo eligieron). */
  username() {
    return store.state.session?.user?.user_metadata?.username || null;
  },

  /** Cuentas creadas con correo, antes de pasar a usuarios. */
  needsUsername() {
    return Boolean(store.state.session?.user) && !this.username();
  },

  /** Refleja en la sesión guardada el usuario recién elegido. */
  setUsername(username) {
    const session = store.state.session;
    if (!session?.user) return;
    const user_metadata = { ...session.user.user_metadata, username };
    persistSession({ ...session, user: { ...session.user, user_metadata } });
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
