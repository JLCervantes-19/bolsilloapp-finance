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
