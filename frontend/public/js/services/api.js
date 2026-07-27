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

async function request(method, path, body) {
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
