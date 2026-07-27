/**
 * Store reactivo mínimo — sin Redux/Zustand, solo lo que pide el prompt
 * maestro ("Custom Reactive State Observers"). `setState` mergea top-level
 * y notifica a los suscriptores; los componentes leen `store.state`
 * directamente y se re-renderizan al recibir la notificación.
 */
function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    get state() {
      return state;
    },
    setState(patch) {
      state = typeof patch === "function" ? { ...state, ...patch(state) } : { ...state, ...patch };
      listeners.forEach((l) => l(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const store = createStore({
  session: null, // { access_token, refresh_token, user }
  dashboard: null,
  analytics: null,
  categories: [],
  debts: [],
  goals: [],
  toast: null,
});
