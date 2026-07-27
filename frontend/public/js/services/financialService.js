import { api } from "./api.js";

export const financialService = {
  getDashboardSummary: () => api.get("/dashboard/summary"),
  getMonthlySeries: (months = 6) => api.get(`/analytics/monthly?months=${months}`),

  listCategories: () => api.get("/categories"),

  listExpenses: (params = "") => api.get(`/expenses${params}`),
  quickExpense: (payload) => api.post("/transactions/quick-expense", payload),
  quickIncome: (payload) => api.post("/transactions/quick-income", payload),

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
