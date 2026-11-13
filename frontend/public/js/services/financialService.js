import { api } from "./api.js";

const qs = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return entries.length ? "?" + new URLSearchParams(entries).toString() : "";
};

export const financialService = {
  // `bolsillo` opcional: limita el resumen a ese bolsillo (sin él, todo el usuario).
  getDashboardSummary: (bolsillo) => api.get(`/dashboard/summary${qs({ bolsillo })}`),
  getMonthlySeries: (months = 6, bolsillo) => api.get(`/analytics/monthly${qs({ months, bolsillo })}`),

  listCategories: (bolsillo) => api.get(`/categories${qs({ bolsillo })}`),
  createCategory: (payload) => api.post("/categories", payload),
  deleteCategory: (id) => api.delete(`/categories/${id}`),

  listExpenses: (params = {}) => api.get(`/expenses${qs(params)}`),
  listIncomes: (params = {}) => api.get(`/incomes${qs(params)}`),
  quickExpense: (payload) => api.post("/transactions/quick-expense", payload),
  quickIncome: (payload) => api.post("/transactions/quick-income", payload),
  updateIncome: (id, payload) => api.patch(`/incomes/${id}`, payload),
  updateExpense: (id, payload) => api.patch(`/expenses/${id}`, payload),
  deleteIncome: (id) => api.delete(`/incomes/${id}`),
  deleteExpense: (id) => api.delete(`/expenses/${id}`),

  // Bolsillos
  listPockets: (params = {}) => api.get(`/pockets${qs(params)}`),
  getPocketOverview: (id, params = {}) => api.get(`/pockets/${id}/overview${qs(params)}`),
  getConsolidated: (params = {}) => api.get(`/pockets/consolidated${qs(params)}`),
  createPocket: (payload) => api.post("/pockets", payload),
  updatePocket: (id, payload) => api.patch(`/pockets/${id}`, payload),
  deletePocket: (id, payload = {}) => api.delete(`/pockets/${id}`, payload),

  // Inversión (aporte), retiro y traslado entre bolsillos
  createTransfer: (payload) => api.post("/transfers", payload),
  updateTransfer: (id, payload) => api.patch(`/transfers/${id}`, payload),
  deleteTransfer: (id) => api.delete(`/transfers/${id}`),

  // Historial unificado: { data, page, pageSize, total }
  listMovements: (params = {}) => api.getRaw(`/movements${qs(params)}`),

  listDebts: () => api.get("/debts"),
  createDebt: (payload) => api.post("/debts", payload),
  updateDebt: (id, payload) => api.patch(`/debts/${id}`, payload),
  deleteDebt: (id) => api.delete(`/debts/${id}`),
  getDebtStrategy: (extraPayment) => api.get(`/debts/strategy?extraPayment=${extraPayment}`),

  listGoals: () => api.get("/goals"),
  contributeToGoal: (id, amount) => api.post(`/goals/${id}/contribute`, { amount }),

  listAlerts: () => api.get("/alerts"),
  generateAlerts: () => api.post("/alerts/generate"),
};
