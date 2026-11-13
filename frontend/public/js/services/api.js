import { API_BASE_URL } from "./config.js";
import { store } from "../store/store.js";
import { authService } from "./auth.js";
import { apiErrorMessage } from "../utils/errors.js";

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const STORAGE_KEY = "onemillion.session";

// Una sola renovación a la vez: si el dashboard dispara 2 requests en
// paralelo y ambos reciben 401, comparten el mismo refresh (Supabase rota
// el refresh_token y reusarlo dos veces fallaría).
// Resultado: "ok" (reintentar), "expired" (sesión inválida → login) o
// "error" (falla temporal: red, 429, 5xx → mantener la sesión).
let refreshing = null;

function refreshSession(failedToken) {
  // Otra pestaña pudo haber renovado ya: si localStorage tiene un token
  // distinto al que falló, se adopta sin gastar el refresh_token.
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (stored?.access_token && stored.access_token !== failedToken) {
      store.setState({ session: stored });
      return Promise.resolve("ok");
    }
  } catch {
    // localStorage inaccesible o corrupto: se sigue con el refresh normal
  }

  const refreshToken = store.state.session?.refresh_token;
  if (!refreshToken) return Promise.resolve("expired");
  if (!refreshing) {
    refreshing = authService
      .refresh(refreshToken)
      .then(
        () => "ok",
        (err) => (err.status === 400 || err.status === 401 ? "expired" : "error")
      )
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request(method, path, body, retried = false, raw = false) {
  const session = store.state.session;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const result = retried ? "expired" : await refreshSession(session?.access_token);
    if (result === "ok") return request(method, path, body, true, raw);
    if (result === "error") throw new ApiError(503, "No se pudo renovar la sesión. Revisá tu conexión e intentá de nuevo.");
    authService.logout();
    window.location.hash = "#/login";
    throw new ApiError(401, "Sesión expirada");
  }

  if (res.status === 204) return null;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, apiErrorMessage(json, "Error de red"), json.error?.details);
  return raw ? json : json.data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  patch: (path, body) => request("PATCH", path, body),
  delete: (path, body) => request("DELETE", path, body),
  // Respuesta completa (no solo `data`), para listados paginados.
  getRaw: (path) => request("GET", path, undefined, false, true),
};
