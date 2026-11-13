import { API_BASE_URL } from "./config.js";
import { store } from "../store/store.js";
import { authService } from "./auth.js";

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Una sola renovación a la vez: si el dashboard dispara 2 requests en
// paralelo y ambos reciben 401, comparten el mismo refresh (Supabase rota
// el refresh_token y reusarlo dos veces fallaría).
let refreshing = null;

function refreshSession() {
  const refreshToken = store.state.session?.refresh_token;
  if (!refreshToken) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = authService
      .refresh(refreshToken)
      .then(() => true, () => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request(method, path, body, retried = false) {
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
    if (!retried && (await refreshSession())) return request(method, path, body, true);
    authService.logout();
    window.location.hash = "#/login";
    throw new ApiError(401, "Sesión expirada");
  }

  if (res.status === 204) return null;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error?.message || "Error de red", json.error?.details);
  return json.data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  patch: (path, body) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path),
};
