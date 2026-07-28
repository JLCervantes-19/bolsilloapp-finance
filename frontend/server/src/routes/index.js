import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";

import { dashboardRouter } from "./dashboard.routes.js";
import { analyticsRouter } from "./analytics.routes.js";
import { categoriesRouter } from "./categories.routes.js";
import { expensesRouter } from "./expenses.routes.js";
import { incomesRouter } from "./incomes.routes.js";
import { debtsRouter } from "./debts.routes.js";
import { budgetsRouter } from "./budgets.routes.js";
import { alertsRouter } from "./alerts.routes.js";
import { goalsRouter } from "./goals.routes.js";
import { savingsRouter } from "./savings.routes.js";
import { investmentsRouter } from "./investments.routes.js";
import { settingsRouter } from "./settings.routes.js";
import { transactionsRouter } from "./transactions.routes.js";
import { auditLogsRouter } from "./auditLogs.routes.js";

export const apiRouter = Router();

// Todo /api/* requiere un access_token de Supabase Auth válido.
apiRouter.use(requireAuth);

apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/categories", categoriesRouter);
apiRouter.use("/expenses", expensesRouter);
apiRouter.use("/incomes", incomesRouter);
apiRouter.use("/debts", debtsRouter);
apiRouter.use("/budgets", budgetsRouter);
apiRouter.use("/alerts", alertsRouter);
apiRouter.use("/goals", goalsRouter);
apiRouter.use("/savings", savingsRouter);
apiRouter.use("/investments", investmentsRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/transactions", transactionsRouter);
apiRouter.use("/audit-logs", auditLogsRouter);
