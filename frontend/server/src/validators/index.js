import { z } from "zod";

const uuid = () => z.string().uuid();
const amount = () => z.number().positive();
const isoDate = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha esperada en formato YYYY-MM-DD");

export const categorySchema = z.object({
  bolsillo_id: uuid().optional(),
  name: z.string().trim().min(1).max(60),
  color: z.string().min(3).max(20),
  kind: z.enum(["income", "expense"]),
});

// `bolsillo_id` opcional en todo lo que registra dinero: si no viene, la base
// usa el bolsillo personal predeterminado (trigger assert_owned_refs).
const paymentMethod = () => z.string().trim().max(60).optional();

export const incomeSchema = z.object({
  bolsillo_id: uuid().optional(),
  category_id: uuid().nullable().optional(),
  payment_method: paymentMethod(),
  amount: amount(),
  description: z.string().max(280).optional(),
  source: z.string().max(120).optional(),
  date: isoDate().optional(),
  recurrence: z.enum(["fixed", "variable", "recurring"]).optional(),
});

export const expenseSchema = z.object({
  bolsillo_id: uuid().optional(),
  category_id: uuid().nullable().optional(),
  amount: amount(),
  description: z.string().max(280).optional(),
  payment_method: paymentMethod(),
  tags: z.array(z.string().max(40)).max(20).optional(),
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
  extraPayment: z.coerce.number().nonnegative().max(1e12).default(0),
});

// Cada mes son 2 consultas en paralelo: sin tope, ?months=5000 dispara 10.000.
export const analyticsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export const dateRangeQuerySchema = z.object({
  start: isoDate().optional(),
  end: isoDate().optional(),
});

// ?bolsillo=<uuid> filtra por un bolsillo; sin parámetro = todos (comportamiento previo).
export const pocketQuerySchema = z.object({
  bolsillo: uuid().optional(),
});

// ---------------------------------------------------------------------------
// Bolsillos y transferencias
// ---------------------------------------------------------------------------
const hexColor = () => z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color esperado en formato #RRGGBB");

export const pocketSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(60),
  kind: z.enum(["personal", "business"]),
  color: hexColor().optional(),
  icon: z.string().trim().min(1).max(16).optional(),
  currency: z.string().trim().toUpperCase().length(3).optional(),
  initial_balance: z.number().nonnegative().max(1e12).optional(),
});

// El tipo no se cambia después de crear (romperia aportes/retiros ya registrados).
export const pocketUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Poné un nombre").max(60),
    color: hexColor(),
    icon: z.string().trim().min(1).max(16),
    currency: z.string().trim().toUpperCase().length(3),
    position: z.number().int().min(0).max(10000),
    archived: z.boolean(),
  })
  .partial();

export const pocketDeleteSchema = z
  .object({
    destino: uuid().optional(),
    borrar_movimientos: z.boolean().optional(),
  })
  .default({});

export const transferSchema = z
  .object({
    kind: z.enum(["aporte", "retiro", "traslado"]),
    from_bolsillo_id: uuid().nullable().optional(),
    to_bolsillo_id: uuid().nullable().optional(),
    amount: amount().max(1e12),
    date: isoDate().optional(),
    description: z.string().trim().max(280).optional(),
    payment_method: paymentMethod(),
  })
  .superRefine((t, ctx) => {
    if (t.kind === "aporte" && !t.to_bolsillo_id) ctx.addIssue({ code: "custom", path: ["to_bolsillo_id"], message: "Elegí el negocio que recibe la inversión" });
    if (t.kind === "retiro" && !t.from_bolsillo_id) ctx.addIssue({ code: "custom", path: ["from_bolsillo_id"], message: "Elegí el negocio del que sale el retiro" });
    if (t.kind === "traslado" && (!t.from_bolsillo_id || !t.to_bolsillo_id)) {
      ctx.addIssue({ code: "custom", path: ["to_bolsillo_id"], message: "Elegí bolsillo de origen y de destino" });
    }
    if (t.from_bolsillo_id && t.from_bolsillo_id === t.to_bolsillo_id) {
      ctx.addIssue({ code: "custom", path: ["to_bolsillo_id"], message: "El origen y el destino tienen que ser bolsillos distintos" });
    }
  });

// Editar una transferencia: no cambia el tipo ni los extremos (se borra y se crea otra).
export const transferUpdateSchema = z
  .object({
    amount: amount().max(1e12),
    date: isoDate(),
    description: z.string().trim().max(280),
    payment_method: z.string().trim().max(60),
  })
  .partial();

export const movementsQuerySchema = z.object({
  bolsillo: uuid().optional(),
  tipo: z.enum(["ingreso", "gasto", "aporte", "retiro", "traslado"]).optional(),
  start: isoDate().optional(),
  end: isoDate().optional(),
  categoria: uuid().optional(),
  metodo: z.string().trim().max(60).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const quickExpenseSchema = z.object({
  bolsillo_id: uuid().optional(),
  category_id: uuid(),
  amount: amount(),
  description: z.string().max(280).optional(),
  payment_method: paymentMethod(),
  date: isoDate().optional(),
});

export const quickIncomeSchema = z.object({
  bolsillo_id: uuid().optional(),
  category_id: uuid(),
  amount: amount(),
  description: z.string().max(280).optional(),
  payment_method: paymentMethod(),
  date: isoDate().optional(),
  allocate_emergency_fund_pct: z.number().min(0).max(100).optional(),
  allocate_investment_pct: z.number().min(0).max(100).optional(),
});
