import { z } from "zod";

const uuid = () => z.string().uuid();
const amount = () => z.number().positive();
const isoDate = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha esperada en formato YYYY-MM-DD");

export const categorySchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().min(3).max(20),
  kind: z.enum(["income", "expense"]),
});

export const incomeSchema = z.object({
  category_id: uuid().nullable().optional(),
  amount: amount(),
  description: z.string().max(280).optional(),
  source: z.string().max(120).optional(),
  date: isoDate().optional(),
  recurrence: z.enum(["fixed", "variable", "recurring"]).optional(),
});

export const expenseSchema = z.object({
  category_id: uuid().nullable().optional(),
  amount: amount(),
  description: z.string().max(280).optional(),
  payment_method: z.string().max(60).optional(),
  tags: z.array(z.string().max(40)).optional(),
  is_fixed: z.boolean().optional(),
  date: isoDate().optional(),
});

export const debtSchema = z.object({
  name: z.string().min(1).max(120),
  balance: z.number().nonnegative(),
  original_balance: z.number().nonnegative(),
  interest_rate: z.number().min(0).max(100).optional(),
  minimum_payment: z.number().nonnegative().optional(),
  term_months: z.number().int().positive().optional(),
  due_date: isoDate().optional(),
  priority: z.number().int().optional(),
  status: z.enum(["active", "paid_off"]).optional(),
});

export const budgetSchema = z.object({
  category_id: uuid(),
  month: isoDate(),
  cap_amount: z.number().nonnegative(),
});

export const goalSchema = z.object({
  name: z.string().min(1).max(120),
  target_amount: amount(),
  current_amount: z.number().nonnegative().optional(),
  target_date: isoDate().nullable().optional(),
  color: z.string().max(40).optional(),
  is_emergency_fund: z.boolean().optional(),
});

export const goalContributionSchema = z.object({
  amount: amount(),
});

export const savingSchema = z.object({
  goal_id: uuid().nullable().optional(),
  amount: amount(),
  type: z.enum(["emergency", "automatic", "manual"]).optional(),
  date: isoDate().optional(),
});

export const investmentSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.string().max(60).optional(),
  amount_invested: z.number().nonnegative(),
  current_value: z.number().nonnegative(),
  date: isoDate().optional(),
});

export const settingsSchema = z.object({
  theme: z.enum(["light", "dark"]).optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().max(10).optional(),
  notifications_enabled: z.boolean().optional(),
});

export const profileSchema = z.object({
  full_name: z.string().min(1).max(120).optional(),
  avatar_url: z.string().url().optional(),
  currency: z.string().length(3).optional(),
});

export const debtStrategyQuerySchema = z.object({
  extraPayment: z.coerce.number().nonnegative().default(0),
});

export const quickExpenseSchema = z.object({
  category_id: uuid(),
  amount: amount(),
  description: z.string().max(280).optional(),
  date: isoDate().optional(),
});

export const quickIncomeSchema = z.object({
  category_id: uuid(),
  amount: amount(),
  description: z.string().max(280).optional(),
  date: isoDate().optional(),
  allocate_emergency_fund_pct: z.number().min(0).max(100).optional(),
  allocate_investment_pct: z.number().min(0).max(100).optional(),
});
