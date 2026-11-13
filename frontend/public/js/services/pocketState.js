import { store } from "../store/store.js";
import { financialService } from "./financialService.js";

/**
 * Bolsillo activo: el filtro principal de toda la app.
 * - `ALL` = vista "Todo / Consolidado".
 * - Se guarda por usuario en localStorage (persiste entre recargas y sesiones
 *   en el mismo dispositivo).
 * - Los saldos vienen del API (cálculo central); aquí no se calcula nada.
 */
export const ALL = "all";

const storageKey = () => `bolsillo.activePocket.${store.state.session?.user?.id || "anon"}`;

function readStored() {
  try {
    return localStorage.getItem(storageKey());
  } catch {
    return null;
  }
}

function writeStored(id) {
  try {
    localStorage.setItem(storageKey(), id);
  } catch {
    // Modo privado / almacenamiento lleno: la selección dura solo esta sesión.
  }
}

export function pockets() {
  return store.state.pockets || [];
}

export function activePockets() {
  return pockets().filter((p) => !p.archived_at);
}

export function defaultPocket() {
  return pockets().find((p) => p.is_default) || null;
}

export function findPocket(id) {
  return pockets().find((p) => p.id === id) || null;
}

/** Bolsillo activo (objeto) o null si está en "Todo / Consolidado". */
export function activePocket() {
  const id = store.state.activePocketId;
  return id === ALL ? null : findPocket(id) || defaultPocket();
}

export function isAll() {
  return store.state.activePocketId === ALL;
}

/** Bolsillo para preseleccionar en formularios: el activo, o el personal si está en Todo / archivado. */
export function pocketForForms() {
  const p = activePocket();
  return p && !p.archived_at ? p : defaultPocket();
}

function resolveActiveId(list, userId) {
  // La selección en memoria solo vale si es del mismo usuario (otra cuenta en la misma pestaña).
  const stored = (store.state.pocketsUserId === userId ? store.state.activePocketId : null) ?? readStored();
  if (stored === ALL) return ALL;
  if (stored && list.some((p) => p.id === stored)) return stored;
  return list.find((p) => p.is_default)?.id || ALL;
}

/** Carga (o recarga) la lista con saldos. `force` = ignorar lo que ya hay en memoria. */
export async function loadPockets({ force = false } = {}) {
  const userId = store.state.session?.user?.id;
  if (!force && store.state.pocketsUserId === userId && pockets().length) return pockets();
  const list = await financialService.listPockets();
  const activePocketId = resolveActiveId(list, userId);
  store.setState({ pockets: list, pocketsUserId: userId, activePocketId });
  writeStored(activePocketId);
  return list;
}

export function setActivePocket(id) {
  store.setState({ activePocketId: id });
  writeStored(id);
  window.dispatchEvent(new CustomEvent("bolsillo:pocket-change", { detail: { id } }));
}

/** Pestañas internas según el tipo del bolsillo activo (rutas existentes + nuevas). */
export function tabsFor(pocket) {
  if (!pocket) {
    return [
      { label: "Resumen", route: "#/dashboard" },
      { label: "Ingresos", route: "#/ingresos" },
      { label: "Gastos", route: "#/gastos" },
      { label: "Movimientos", route: "#/movimientos" },
    ];
  }
  if (pocket.kind === "business") {
    return [
      { label: "Resumen", route: "#/dashboard" },
      { label: "Ingresos", route: "#/ingresos" },
      { label: "Egresos", route: "#/gastos" },
      { label: "Inversión", route: "#/inversion" },
      { label: "Retiros", route: "#/retiros" },
      { label: "Movimientos", route: "#/movimientos" },
    ];
  }
  return [
    { label: "Resumen", route: "#/dashboard" },
    { label: "Ingresos", route: "#/ingresos" },
    { label: "Gastos", route: "#/gastos" },
    { label: "Movimientos", route: "#/movimientos" },
  ];
}

export const KIND_LABEL = { personal: "Personal", business: "Negocio" };

export const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta débito", "Tarjeta crédito", "Otro"];
