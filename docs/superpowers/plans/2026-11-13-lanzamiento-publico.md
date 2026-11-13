# Preparación para lanzamiento público — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar Bolsillo lista para recibir público real: sin bugs de lógica que corrompan saldos o fechas, sin sesiones que se cierren solas, con límites de uso justos, borrado de cuenta y aceptación de política de datos.

**Architecture:** SPA vanilla JS (`frontend/public`) + Express 5 (`frontend/server/src`) desplegado como función serverless en Vercel (`frontend/api/index.js`), Supabase Postgres con RLS. Toda consulta de negocio usa el JWT del usuario (rol `authenticated`), así que la lógica de dinero que necesita atomicidad se mueve a funciones Postgres `security invoker` (RLS sigue aplicando).

**Tech Stack:** Node 20 local / 24 en Vercel, Express 5, supabase-js 2, zod, `node:test` (sin dependencias nuevas), Supabase MCP para migraciones.

**Spec:** Diagnóstico de la sesión del 2026-11-13 (auditoría de seguridad + revisión de lógica). Resumen de hallazgos al final de este archivo ("Anexo: hallazgos").

## Global Constraints

- Proyecto Supabase: `tsjzybxgaeltxhnkqpry` (bolsillo-app). Migraciones con `mcp__supabase__apply_migration`; reflejar cada una en `schema_supabase.txt`.
- Zona horaria de negocio: `America/Bogota` (UTC-5, sin horario de verano).
- Toda función Postgres nueva: `security invoker`, `set search_path = public`, `revoke execute ... from public, anon`, `grant execute ... to authenticated`.
- Mensajes al usuario en español (voseo/tuteo como el resto de la app: "Iniciá sesión", "revisá").
- Sin dependencias npm nuevas (salvo subir `zod` a v4 en la Tarea 9). Tests con `node --test`.
- `frontend/package.json` y `frontend/server/package.json` deben tener las mismas versiones de dependencias del backend (Vercel instala solo `frontend/node_modules`).
- Deploy: push a `main` → Vercel despliega solo. No hay pasos manuales en Vercel salvo los de la Fase 0.

## Review Focus

- Usuario en Colombia registra un gasto entre 7 p. m. y medianoche → debe quedar con la fecha de HOY en Colombia, no la de mañana (Tarea 1, test `todayISO` con `2026-12-01T03:00:00Z`).
- Usuario deja la app abierta más de 1 hora → la siguiente acción debe funcionar sin mandarlo al login (Tarea 2, verificación manual con token vencido).
- Varios usuarios detrás de la misma IP (datos móviles con CGNAT, oficina) → no deben bloquearse entre sí con 429 (Tarea 3, test `userKey`).
- Doble toque en "Abonar" o dos pestañas abiertas → la meta debe sumar ambos abonos, no perder uno (Tarea 5, smoke test de saldo exacto).
- Usuario con más de 1000 gastos → el saldo disponible debe seguir siendo exacto (Tarea 4, función SQL con `sum`).

---

## Fase 0 — Acciones manuales (las hace el dueño del proyecto, no código)

Estas no se pueden automatizar desde el repo porque requieren pagar, crear cuentas o decidir.

- [ ] **0.1 Supabase a plan Pro (US$25/mes).** En el plan gratis el proyecto se pausa tras 7 días sin actividad (es lo que pasó esta semana: la app queda caída para todos) y no hay backups diarios. Dashboard → Organization → Billing.
- [ ] **0.2 SMTP propio para correos de Auth.** El SMTP por defecto de Supabase solo envía a correos del equipo y ~2 por hora: "Olvidé mi contraseña" NO funciona para el público. Crear cuenta en Resend (gratis 3000/mes), verificar un dominio propio (no sirve `vercel.app`), y en Supabase → Authentication → Emails → SMTP Settings cargar host `smtp.resend.com`, puerto 465, usuario `resend`, contraseña = API key de Resend.
- [ ] **0.3 Dominio propio** (lo exige 0.2). Comprarlo, agregarlo en Vercel → Project → Domains, y actualizar en Vercel la variable `FRONTEND_URL` y en Supabase → Authentication → URL Configuration el *Site URL* y *Redirect URLs* con el dominio nuevo.
- [ ] **0.4 Protección de contraseñas filtradas:** Supabase → Authentication → Providers → Email → *Prevent use of leaked passwords* (requiere Pro, ver 0.1).
- [ ] **0.5 Decidir confirmación de correo.** Hoy el registro crea la cuenta confirmada sin verificar el correo (cualquiera puede registrarse con un correo ajeno). Si se decide exigirla, se hace después de 0.2 cambiando `email_confirm: true` por `anonClient.auth.signUp` en `frontend/server/src/routes/auth.routes.js` (el frontend ya maneja `data.session === null` con el toast "revisá tu correo").
- [ ] **0.6 Textos legales.** Generar en TermsFeed o Termly la *Política de Tratamiento de Datos* (Ley 1581 de 2012 — Colombia) y los *Términos de Uso*. Se pegan en `frontend/public/privacidad.html` y `frontend/public/terminos.html` (Tarea 8 crea los archivos).
- [ ] **0.7 Vercel Hobby es solo uso no comercial.** Si la app cobra o tiene publicidad, pasar a Vercel Pro.
- [ ] **0.8 Extras de seguridad:** activar GitGuardian en el repo de GitHub, revisar colaboradores del repo, y (opcional) poner Cloudflare delante del dominio.

---

## Fase 1 — Código

**Orden de ejecución:** 1 → 2 → 3 → **6** → 4 → 5 → 7 → 8 → 9 → 10. La Tarea 6 crea `toApiError`, que usan la 4 y la 5; la 10 necesita `accepted_privacy` (8) y el endpoint de borrado (8).

### Mapa de archivos

| Archivo | Responsabilidad | Tareas |
|---|---|---|
| `frontend/server/package.json` | script `test` | 1, 9 |
| `frontend/server/test/*.test.js` | tests `node:test` | 1, 3, 6, 7, 9 |
| `frontend/server/src/utils/dateRange.js` | fechas en hora Colombia | 1 |
| `frontend/server/src/controllers/alerts.controller.js` | "hoy" de alertas | 1 |
| `frontend/public/js/utils/formatters.js` | `todayISO` del dispositivo | 1 |
| `frontend/public/js/services/api.js`, `auth.js` | refresh de sesión | 2, 8 |
| `frontend/server/src/middlewares/rateLimit.js` (nuevo) | limitadores | 3 |
| `frontend/server/src/app.js`, `routes/index.js` | montar limitadores | 3 |
| `frontend/server/src/services/dashboard.service.js`, `analytics.service.js` | saldo vía SQL | 4 |
| `frontend/server/src/controllers/goals.controller.js`, `services/transactions.service.js` | dinero atómico | 5 |
| `frontend/server/src/utils/dbError.js` (nuevo) | errores de BD → mensajes | 6 |
| `frontend/server/src/repositories/*.js` | usar `toApiError` | 6 |
| `frontend/server/src/validators/index.js` | query params | 6, 9 |
| `frontend/server/src/services/engines/debtEngine.js`, `frontend/public/js/pages/Deudas.js` | deudas impagables | 7 |
| `frontend/server/src/routes/auth.routes.js`, `frontend/public/js/components/PageHeader.js`, `frontend/public/js/pages/Login.js` | borrar cuenta + consentimiento | 8 |
| `frontend/server/scripts/smoke-test.sh` (nuevo) | prueba de humo end-to-end | 10 |
| `schema_supabase.txt` | esquema versionado | 1, 4, 5, 6 |

---

### Task 1: Fechas en hora de Colombia (+ infraestructura de tests)

**Problema:** `todayISO()` del frontend usa `toISOString()` (UTC) y el servidor en Vercel corre en UTC. Entre las 7 p. m. y medianoche en Colombia, un gasto queda con la fecha de mañana; el último día del mes después de las 7 p. m. el dashboard ya muestra el mes siguiente.

**Files:**
- Modify: `frontend/server/package.json` (scripts)
- Modify: `frontend/server/src/utils/dateRange.js`
- Modify: `frontend/server/src/controllers/alerts.controller.js:19-23`
- Modify: `frontend/public/js/utils/formatters.js:21-23`
- Create: `frontend/server/test/dateRange.test.js`
- Migration: `default_dates_bogota`

**Interfaces:**
- Produces: `todayInAppTz(now?: Date): Date` (fecha local a medianoche representando el día en Bogotá), `todayISO(now?: Date): string` (`YYYY-MM-DD`), `APP_TIME_ZONE = "America/Bogota"`. `currentMonthRange/previousMonthRange/lastMonthsRanges` conservan firma; su `reference` por defecto pasa a `todayInAppTz()`.

- [ ] **Step 1: Agregar script de tests**

En `frontend/server/package.json`, dentro de `"scripts"` agregar:

```json
    "test": "node --test"
```

- [ ] **Step 2: Escribir el test que falla**

Crear `frontend/server/test/dateRange.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { todayISO, currentMonthRange, previousMonthRange, lastMonthsRanges } from "../src/utils/dateRange.js";

test("todayISO usa la fecha de Bogotá, no la UTC", () => {
  // 1 dic 03:00 UTC = 30 nov 22:00 en Bogotá
  assert.equal(todayISO(new Date("2026-12-01T03:00:00Z")), "2026-11-30");
  // 1 dic 05:00 UTC = 1 dic 00:00 en Bogotá
  assert.equal(todayISO(new Date("2026-12-01T05:00:00Z")), "2026-12-01");
});

test("currentMonthRange cubre el mes completo", () => {
  assert.deepEqual(currentMonthRange(new Date(2026, 1, 15)), { start: "2026-02-01", end: "2026-02-28" });
});

test("previousMonthRange cruza el año", () => {
  assert.deepEqual(previousMonthRange(new Date(2026, 0, 10)), { start: "2025-12-01", end: "2025-12-31" });
});

test("lastMonthsRanges devuelve N meses, el más viejo primero", () => {
  const r = lastMonthsRanges(3, new Date(2026, 0, 10));
  assert.deepEqual(r.map((x) => x.start), ["2025-11-01", "2025-12-01", "2026-01-01"]);
});
```

- [ ] **Step 3: Correr y ver que falla**

Run: `cd frontend/server && npm test`
Expected: FAIL — `todayISO` no está exportado (`SyntaxError: The requested module ... does not provide an export named 'todayISO'`).

- [ ] **Step 4: Implementar**

En `frontend/server/src/utils/dateRange.js`, después de `toISODate`, agregar:

```js
export const APP_TIME_ZONE = "America/Bogota";

/**
 * "Hoy" según Colombia, sin importar la zona del servidor (Vercel corre en
 * UTC). Devuelve un Date local a medianoche con ese año/mes/día, para que
 * las funciones de abajo puedan seguir usando getFullYear()/getMonth().
 */
export function todayInAppTz(now = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(now = new Date()) {
  return toISODate(todayInAppTz(now));
}
```

Y cambiar el valor por defecto de `reference` en las tres funciones existentes de `reference = new Date()` a `reference = todayInAppTz()`.

- [ ] **Step 5: Usar "hoy" de Colombia en alertas**

En `frontend/server/src/controllers/alerts.controller.js` agregar el import `import { todayISO } from "../utils/dateRange.js";` y reemplazar:

```js
    const today = new Date().toISOString().slice(0, 10);
    const existing = await alertsRepository.list(req.supabase, { orderBy: "created_at", ascending: false });
    const alreadyToday = new Set(
      existing.filter((a) => a.created_at.slice(0, 10) === today).map((a) => a.type)
    );
```

por:

```js
    const today = todayISO();
    const existing = await alertsRepository.list(req.supabase, { orderBy: "created_at", ascending: false });
    const alreadyToday = new Set(
      existing.filter((a) => todayISO(new Date(a.created_at)) === today).map((a) => a.type)
    );
```

- [ ] **Step 6: Frontend — fecha del dispositivo**

En `frontend/public/js/utils/formatters.js` reemplazar `todayISO`:

```js
// Fecha local del dispositivo (no UTC): toISOString() adelantaba el día
// después de las 7 p. m. en Colombia.
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
```

- [ ] **Step 7: Migración de defaults en BD**

`apply_migration` nombre `default_dates_bogota`:

```sql
-- current_date es UTC en Supabase; las filas sin fecha explícita deben
-- quedar con el día de Colombia.
alter table public.gastos      alter column date set default (now() at time zone 'America/Bogota')::date;
alter table public.ingresos    alter column date set default (now() at time zone 'America/Bogota')::date;
alter table public.ahorros     alter column date set default (now() at time zone 'America/Bogota')::date;
alter table public.inversiones alter column date set default (now() at time zone 'America/Bogota')::date;
```

Reflejar en `schema_supabase.txt`: en cada `create table` de esas 4 tablas, cambiar `default current_date` por `default ((now() at time zone 'America/Bogota')::date)`.

- [ ] **Step 8: Correr tests**

Run: `cd frontend/server && npm test`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add frontend/server/package.json frontend/server/test/dateRange.test.js frontend/server/src/utils/dateRange.js frontend/server/src/controllers/alerts.controller.js frontend/public/js/utils/formatters.js schema_supabase.txt
git commit -m "Usa la hora de Colombia para fechas de gastos, ingresos y rangos del mes"
```

---

### Task 2: Renovación automática de sesión

**Problema:** el access token de Supabase dura 1 hora y `api.js` cierra sesión ante cualquier 401. `/api/auth/refresh` existe pero nadie lo llama: todo usuario es expulsado cada hora.

**Files:**
- Modify: `frontend/public/js/services/auth.js` (agregar `refresh`)
- Modify: `frontend/public/js/services/api.js:13-35`

**Interfaces:**
- Produces: `authService.refresh(refreshToken: string): Promise<session>` — persiste la nueva sesión.

- [ ] **Step 1: Agregar `refresh` a authService**

En `frontend/public/js/services/auth.js`, dentro de `authService`, después de `login`:

```js
  async refresh(refreshToken) {
    const data = await request("refresh", { refresh_token: refreshToken });
    persistSession(data.session);
    return data.session;
  },
```

- [ ] **Step 2: Reintentar una vez tras refrescar**

En `frontend/public/js/services/api.js`, reemplazar la función `request` completa por:

```js
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
```

- [ ] **Step 3: Verificación manual (local)**

Levantar backend (`cd frontend/server && npm run dev`) y frontend (`cd frontend && npm run serve`), iniciar sesión en `http://localhost:5173`, y en la consola del navegador:

```js
const s = JSON.parse(localStorage.getItem("bolsillo.session"));
s.access_token = "token-vencido";
localStorage.setItem("bolsillo.session", JSON.stringify(s));
location.reload();
```

Expected: el dashboard carga normalmente (sin ir al login) y en la pestaña Network aparece un `POST /api/auth/refresh` con 200 seguido de los reintentos con 200.

Luego borrar también el refresh token (`s.refresh_token = "x"`) y recargar → Expected: redirige a `#/login`.

- [ ] **Step 4: Commit**

```bash
git add frontend/public/js/services/api.js frontend/public/js/services/auth.js
git commit -m "Renueva la sesión automáticamente en vez de cerrar sesión cada hora"
```

---

### Task 3: Límite de peticiones por usuario (no por IP)

**Problema:** 100 req/15 min por IP. Cada pantalla hace 2 llamadas pesadas; un usuario activo o varios usuarios tras la misma IP (CGNAT de operadores móviles en Colombia, redes de oficina/universidad) reciben 429. Además `/auth/refresh` (Tarea 2) compartiría el límite de 10 de login.

**Files:**
- Create: `frontend/server/src/middlewares/rateLimit.js`
- Modify: `frontend/server/src/app.js` (bloque de rate limit)
- Modify: `frontend/server/src/routes/index.js:23-24`
- Create: `frontend/server/test/rateLimit.test.js`

**Interfaces:**
- Produces: `userKey(req): string`, `ipFloodLimiter`, `authLimiter`, `refreshLimiter`, `userLimiter` (middlewares de express-rate-limit).

- [ ] **Step 1: Test que falla**

Crear `frontend/server/test/rateLimit.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { userKey } from "../src/middlewares/rateLimit.js";

test("userKey agrupa por usuario autenticado", () => {
  assert.equal(userKey({ user: { id: "abc" }, ip: "1.1.1.1" }), "user:abc");
});

test("userKey cae a la IP si no hay usuario", () => {
  assert.equal(userKey({ ip: "1.1.1.1" }), "ip:1.1.1.1");
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd frontend/server && npm test`
Expected: FAIL — `Cannot find module '.../middlewares/rateLimit.js'`.

- [ ] **Step 3: Implementar el módulo**

Crear `frontend/server/src/middlewares/rateLimit.js`:

```js
import rateLimit from "express-rate-limit";

const common = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Demasiadas solicitudes. Esperá un momento y volvé a intentar." } },
};

/** Clave por usuario autenticado; si no hay, por IP. */
export function userKey(req) {
  return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
}

// Anti-inundación por IP, alto a propósito: detrás de una misma IP pueden
// estar muchos usuarios legítimos (CGNAT móvil, oficinas).
export const ipFloodLimiter = rateLimit({ ...common, limit: 1000 });

// Fuerza bruta de login/registro/recuperación. /refresh tiene el suyo.
export const authLimiter = rateLimit({ ...common, limit: 20, skip: (req) => req.path === "/refresh" });
export const refreshLimiter = rateLimit({ ...common, limit: 60 });

// Uso normal de la API, por usuario (se monta después de requireAuth).
export const userLimiter = rateLimit({ ...common, limit: 300, keyGenerator: userKey });
```

- [ ] **Step 4: Montarlo**

En `frontend/server/src/app.js`: borrar el import `import rateLimit from "express-rate-limit";`, agregar `import { ipFloodLimiter, authLimiter, refreshLimiter } from "./middlewares/rateLimit.js";` y reemplazar:

```js
  // Rate limit general — 100 req / 15 min por IP; auth más estricto (10
  // intentos / 15 min) para frenar fuerza bruta de login.
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
```

por:

```js
  // Límites: ver middlewares/rateLimit.js (IP solo anti-inundación; el uso
  // normal de /api se limita por usuario dentro de apiRouter).
  app.use(ipFloodLimiter);
```

y la línea `app.use("/api/auth", authLimiter, authRouter);` por:

```js
  app.use("/api/auth/refresh", refreshLimiter);
  app.use("/api/auth", authLimiter, authRouter);
```

En `frontend/server/src/routes/index.js` agregar `import { userLimiter } from "../middlewares/rateLimit.js";` y justo después de `apiRouter.use(requireAuth);`:

```js
apiRouter.use(userLimiter);
```

- [ ] **Step 5: Tests + verificación de headers**

Run: `cd frontend/server && npm test` → Expected: PASS.
Run (con el server local corriendo): `curl -sI localhost:3001/api/dashboard/summary -H "Authorization: Bearer x" | grep -i ratelimit-limit`
Expected: `RateLimit-Limit: 1000` (401 por token inválido, sin pasar por userLimiter).

- [ ] **Step 6: Commit**

```bash
git add frontend/server/src/middlewares/rateLimit.js frontend/server/src/app.js frontend/server/src/routes/index.js frontend/server/test/rateLimit.test.js
git commit -m "Limita la API por usuario y separa límites de login y refresh"
```

---

### Task 4: Saldo disponible calculado en SQL

**Problema:** `computeAvailableBalance` trae TODAS las filas de ingresos/gastos y suma en JS. PostgREST corta en 1000 filas → con más de 1000 movimientos el saldo es incorrecto en silencio. Además ignora `error` (si una consulta falla, suma como 0 y muestra un saldo falso). `analytics.service.js` duplica el cálculo con una fórmula distinta (`current_value` en vez de `amount_invested`).

**Files:**
- Migration: `get_balance_totals`
- Modify: `frontend/server/src/services/dashboard.service.js:10-31`
- Modify: `frontend/server/src/services/analytics.service.js:44-51`
- Modify: `schema_supabase.txt`

**Interfaces:**
- Consumes: `toApiError` de Tarea 6 — si Tarea 6 aún no está hecha, usar `ApiError.badRequest(error.message)` y Tarea 6 lo reemplaza.
- Produces: RPC `get_balance_totals() → { total_income, total_expenses, total_saved, total_invested }`; `export async function computeAvailableBalance(supabase): Promise<number>` desde `dashboard.service.js`.

- [ ] **Step 1: Migración**

`apply_migration` nombre `get_balance_totals`:

```sql
create or replace function public.get_balance_totals()
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'total_income',   coalesce((select sum(amount)          from ingresos    where user_id = auth.uid()), 0),
    'total_expenses', coalesce((select sum(amount)          from gastos      where user_id = auth.uid()), 0),
    'total_saved',    coalesce((select sum(current_amount)  from metas       where user_id = auth.uid()), 0),
    'total_invested', coalesce((select sum(amount_invested) from inversiones where user_id = auth.uid()), 0)
  );
$$;
revoke execute on function public.get_balance_totals() from public, anon;
grant execute on function public.get_balance_totals() to authenticated;
```

Copiar el mismo SQL al final de la sección de funciones de `schema_supabase.txt`.

- [ ] **Step 2: Usarla en dashboard**

En `dashboard.service.js` reemplazar la función `computeAvailableBalance` completa (manteniendo el comentario de arriba) por:

```js
export async function computeAvailableBalance(supabase) {
  const { data, error } = await supabase.rpc("get_balance_totals");
  if (error) throw toApiError(error);
  return Number(data.total_income) - Number(data.total_expenses) - Number(data.total_saved) - Number(data.total_invested);
}
```

con `import { toApiError } from "../utils/dbError.js";` arriba.

- [ ] **Step 3: Reusar en analytics**

En `analytics.service.js` agregar `import { computeAvailableBalance } from "./dashboard.service.js";` y reemplazar:

```js
  const { data: allIncomes } = await supabase.from("ingresos").select("amount");
  const { data: allExpenses } = await supabase.from("gastos").select("amount");
  const balance =
    (allIncomes || []).reduce((s, r) => s + Number(r.amount), 0) -
    (allExpenses || []).reduce((s, r) => s + Number(r.amount), 0) -
    totalSavings -
    totalInvestments;
```

por:

```js
  const balance = await computeAvailableBalance(supabase);
```

- [ ] **Step 4: Verificación**

Con server local y un usuario de prueba (o esperar al smoke test de Tarea 10): `GET /api/dashboard/summary` y `GET /api/analytics/monthly` → 200, y `networth` del último mes de analytics igual a `netWorth` del dashboard.

- [ ] **Step 5: Commit**

```bash
git add frontend/server/src/services/dashboard.service.js frontend/server/src/services/analytics.service.js schema_supabase.txt
git commit -m "Calcula el saldo disponible en SQL (sin tope de 1000 filas ni errores silenciados)"
```

---

### Task 5: Operaciones de dinero atómicas y un solo fondo de emergencia

**Problema:** "Abonar a meta" y la asignación automática de ingresos hacen *leer → sumar en JS → escribir* en pasos separados. Doble toque o dos pestañas = se pierde un abono; si falla el segundo paso queda la meta sumada sin registro en `ahorros`. Además nada impide 2 metas con `is_emergency_fund` → `getEmergencyFund` (`maybeSingle`) revienta y el ingreso rápido falla.

**Files:**
- Migration: `atomic_money_ops`
- Modify: `frontend/server/src/controllers/goals.controller.js:32-52`
- Modify: `frontend/server/src/services/transactions.service.js:39-73`
- Modify: `frontend/server/src/repositories/goals.repository.js` (borrar `incrementCurrentAmount`)
- Modify: `schema_supabase.txt`

**Interfaces:**
- Produces: RPC `contribute_to_goal(p_goal_id uuid, p_amount numeric, p_type text default null) → { goal, saving }`; RPC `add_auto_investment(p_amount numeric) → inversiones row`; índices únicos `metas_one_emergency_fund_per_user`, `inversiones_auto_one_per_user`.

- [ ] **Step 1: Verificar que no haya duplicados** (ya verificado el 2026-11-13: 0 filas; repetir antes de migrar)

```sql
select 'metas', user_id, count(*) from public.metas where is_emergency_fund group by user_id having count(*) > 1
union all
select 'inversiones', user_id, count(*) from public.inversiones where type = 'automatic' and name = 'Aportes automáticos' group by user_id having count(*) > 1;
```
Expected: 0 filas. Si hay filas, detenerse y consultar al dueño.

- [ ] **Step 2: Migración**

`apply_migration` nombre `atomic_money_ops`:

```sql
create unique index if not exists metas_one_emergency_fund_per_user
  on public.metas (user_id) where is_emergency_fund;

create unique index if not exists inversiones_auto_one_per_user
  on public.inversiones (user_id) where type = 'automatic' and name = 'Aportes automáticos';

-- Suma al current_amount y registra el abono en una sola transacción.
create or replace function public.contribute_to_goal(p_goal_id uuid, p_amount numeric, p_type text default null)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_goal public.metas;
  v_saving public.ahorros;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0' using errcode = '22023';
  end if;

  update public.metas set current_amount = current_amount + p_amount
  where id = p_goal_id
  returning * into v_goal;
  if not found then
    raise exception 'Meta no encontrada' using errcode = 'P0002';
  end if;

  insert into public.ahorros (user_id, goal_id, amount, type)
  values (auth.uid(), p_goal_id, p_amount,
          coalesce(p_type, case when v_goal.is_emergency_fund then 'emergency' else 'manual' end))
  returning * into v_saving;

  return json_build_object('goal', to_jsonb(v_goal), 'saving', to_jsonb(v_saving));
end;
$$;

-- Crea o incrementa la inversión "Aportes automáticos" de forma atómica.
create or replace function public.add_auto_investment(p_amount numeric)
returns public.inversiones
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.inversiones;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0' using errcode = '22023';
  end if;

  insert into public.inversiones (user_id, name, type, amount_invested, current_value)
  values (auth.uid(), 'Aportes automáticos', 'automatic', p_amount, p_amount)
  on conflict (user_id) where type = 'automatic' and name = 'Aportes automáticos'
  do update set amount_invested = inversiones.amount_invested + excluded.amount_invested,
                current_value   = inversiones.current_value   + excluded.current_value
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.contribute_to_goal(uuid, numeric, text) from public, anon;
revoke execute on function public.add_auto_investment(numeric) from public, anon;
grant execute on function public.contribute_to_goal(uuid, numeric, text) to authenticated;
grant execute on function public.add_auto_investment(numeric) to authenticated;
```

Copiar el SQL a `schema_supabase.txt`.

- [ ] **Step 3: goals.controller usa la RPC**

Reemplazar el handler `contribute` por:

```js
  contribute: asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase.rpc("contribute_to_goal", {
      p_goal_id: req.params.id,
      p_amount: req.body.amount,
    });
    if (error) throw toApiError(error);
    res.status(201).json({ data });
  }),
```

Imports: agregar `import { toApiError } from "../utils/dbError.js";`; quitar `savingsRepository` y `ApiError` si quedan sin uso.

- [ ] **Step 4: transactions.service usa las RPC**

Reemplazar los dos bloques `if (allocate_emergency_fund_pct > 0) {...}` y `if (allocate_investment_pct > 0) {...}` por:

```js
  if (allocate_emergency_fund_pct > 0) {
    const emergencyFund = await goalsRepository.getEmergencyFund(supabase);
    const alloc = Math.round(amount * (allocate_emergency_fund_pct / 100));
    if (emergencyFund && alloc > 0) {
      const { data, error } = await supabase.rpc("contribute_to_goal", {
        p_goal_id: emergencyFund.id,
        p_amount: alloc,
        p_type: "automatic",
      });
      if (error) throw toApiError(error);
      emergencyFundAllocation = data.saving;
    }
  }

  if (allocate_investment_pct > 0) {
    const alloc = Math.round(amount * (allocate_investment_pct / 100));
    if (alloc > 0) {
      const { data, error } = await supabase.rpc("add_auto_investment", { p_amount: alloc });
      if (error) throw toApiError(error);
      investmentAllocation = data;
    }
  }
```

Imports: agregar `toApiError`; quitar `savingsRepository` e `investmentsRepository`. En `goals.repository.js` borrar `incrementCurrentAmount` (queda sin uso).

- [ ] **Step 5: Verificación**

Se cubre en el smoke test (Tarea 10): saldo exacto 79000 tras abono + ingreso con asignaciones, y 409 al crear un segundo fondo de emergencia.

- [ ] **Step 6: Commit**

```bash
git add frontend/server/src/controllers/goals.controller.js frontend/server/src/services/transactions.service.js frontend/server/src/repositories/goals.repository.js schema_supabase.txt
git commit -m "Hace atómicos los abonos y aportes automáticos; un solo fondo de emergencia por usuario"
```

---

### Task 6: Errores de BD legibles, validación de parámetros e integridad entre usuarios

**Problema:** (a) los repositorios devuelven al usuario el mensaje crudo de Postgres (en inglés, revela nombres de tablas) y todo como 400; (b) `?start=&end=` de gastos/ingresos y `?extraPayment` no se validan; (c) se puede guardar un gasto con `category_id` de otra cuenta (la FK solo verifica que exista).

**Files:**
- Create: `frontend/server/src/utils/dbError.js`
- Create: `frontend/server/test/dbError.test.js`
- Modify: todos los `frontend/server/src/repositories/*.js` que tengan `ApiError.badRequest(error.message)`
- Modify: `frontend/server/src/validators/index.js` (agregar `dateRangeQuerySchema`; `debtStrategyQuerySchema` ya existe)
- Modify: `frontend/server/src/controllers/expenses.controller.js:7`, `incomes.controller.js:7`, `debts.controller.js:45`
- Migration: `assert_owned_refs`

**Interfaces:**
- Produces: `toApiError(error: { code?: string, message?: string }): ApiError`; `dateRangeQuerySchema` (zod, `{ start?, end? }`).

- [ ] **Step 1: Test que falla**

Crear `frontend/server/test/dbError.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { toApiError } from "../src/utils/dbError.js";

test("unique de fondo de emergencia → 409 con mensaje propio", () => {
  const e = toApiError({ code: "23505", message: 'duplicate key value violates unique constraint "metas_one_emergency_fund_per_user"' });
  assert.equal(e.statusCode, 409);
  assert.equal(e.message, "Ya tienes un fondo de emergencia.");
});

test("uuid mal formado → 400", () => {
  assert.equal(toApiError({ code: "22P02", message: "invalid input syntax for type uuid" }).statusCode, 400);
});

test("FK / referencia ajena → 400", () => {
  assert.equal(toApiError({ code: "23503", message: "x" }).statusCode, 400);
});

test("no encontrado → 404", () => {
  assert.equal(toApiError({ code: "P0002", message: "Meta no encontrada" }).statusCode, 404);
});

test("22023 conserva nuestro mensaje", () => {
  assert.equal(toApiError({ code: "22023", message: "El monto debe ser mayor a 0" }).message, "El monto debe ser mayor a 0");
});

test("desconocido → 500 genérico, sin filtrar el mensaje de Postgres", () => {
  const e = toApiError({ code: "XX000", message: "relation public.gastos ..." });
  assert.equal(e.statusCode, 500);
  assert.equal(e.message, "Error interno del servidor");
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd frontend/server && npm test` → Expected: FAIL (`Cannot find module .../utils/dbError.js`).

- [ ] **Step 3: Implementar**

Crear `frontend/server/src/utils/dbError.js`:

```js
import { ApiError } from "./ApiError.js";

const UNIQUE_MESSAGES = {
  metas_one_emergency_fund_per_user: "Ya tienes un fondo de emergencia.",
  budgets_user_id_category_id_month_key: "Ya existe un presupuesto para esa categoría en ese mes.",
};

/**
 * Traduce un error de PostgREST/Postgres a un ApiError con mensaje en
 * español. Nunca reenvía el texto crudo de Postgres al usuario (revela
 * nombres de tablas/columnas); lo desconocido se loguea y responde 500.
 */
export function toApiError(error) {
  switch (error?.code) {
    case "23505": {
      const constraint = /constraint "([^"]+)"/.exec(error.message || "")?.[1];
      return new ApiError(409, UNIQUE_MESSAGES[constraint] || "Ya existe un registro igual.");
    }
    case "23503":
      return ApiError.badRequest("La categoría o meta seleccionada no es válida.");
    case "22P02":
      return ApiError.badRequest("Identificador o valor con formato inválido.");
    case "23514":
    case "22007":
    case "22008":
      return ApiError.badRequest("Algún valor no es válido.");
    case "22023":
      return ApiError.badRequest(error.message);
    case "P0002":
    case "PGRST116":
      return ApiError.notFound("Registro no encontrado.");
    default:
      console.error("[db]", error);
      return ApiError.internal();
  }
}
```

- [ ] **Step 4: Reemplazar en repositorios**

```bash
cd frontend/server/src
grep -rl 'ApiError.badRequest(error.message)' repositories services controllers
```

En cada archivo listado: reemplazar `throw ApiError.badRequest(error.message)` por `throw toApiError(error)` y agregar `import { toApiError } from "../utils/dbError.js";` (en `services/engines` no aplica). Si `ApiError` queda sin uso en el archivo, quitar su import.

Run: `grep -rn 'error.message' repositories services controllers` → Expected: sin coincidencias que lleguen a la respuesta HTTP.

- [ ] **Step 5: Validar query params**

En `validators/index.js` agregar:

```js
export const dateRangeQuerySchema = z.object({
  start: isoDate().optional(),
  end: isoDate().optional(),
});
```

y cambiar `debtStrategyQuerySchema` a `extraPayment: z.coerce.number().nonnegative().max(1e12).default(0)`.

En `expenses.controller.js` e `incomes.controller.js`, reemplazar la primera línea de `list` por:

```js
    const q = dateRangeQuerySchema.safeParse(req.query);
    if (!q.success) throw ApiError.badRequest("Rango de fechas inválido (formato YYYY-MM-DD)");
    const { start, end } = q.data.start && q.data.end ? q.data : currentMonthRange();
```

(imports: `ApiError` de `../utils/ApiError.js` y `dateRangeQuerySchema` de `../validators/index.js`).

En `debts.controller.js` reemplazar `const extraPayment = Number(req.query.extraPayment) || 0;` por:

```js
    const q = debtStrategyQuerySchema.safeParse(req.query);
    if (!q.success) throw ApiError.badRequest("Pago extra inválido");
    const { extraPayment } = q.data;
```

(imports: `ApiError`, `debtStrategyQuerySchema`).

- [ ] **Step 6: Migración de integridad entre usuarios**

`apply_migration` nombre `assert_owned_refs`:

```sql
-- La FK solo comprueba que la categoría/meta exista, no que sea del mismo
-- usuario. Esto lo exige explícitamente.
create or replace function public.assert_owned_refs()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if TG_TABLE_NAME = 'ahorros' then
    if new.goal_id is not null
       and not exists (select 1 from metas where id = new.goal_id and user_id = new.user_id) then
      raise exception 'Meta inválida' using errcode = '23503';
    end if;
  elsif new.category_id is not null
        and not exists (select 1 from categorias where id = new.category_id and user_id = new.user_id) then
    raise exception 'Categoría inválida' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger gastos_assert_owned_refs before insert or update of category_id, user_id on public.gastos
  for each row execute function public.assert_owned_refs();
create trigger ingresos_assert_owned_refs before insert or update of category_id, user_id on public.ingresos
  for each row execute function public.assert_owned_refs();
create trigger presupuestos_assert_owned_refs before insert or update of category_id, user_id on public.presupuestos
  for each row execute function public.assert_owned_refs();
create trigger ahorros_assert_owned_refs before insert or update of goal_id, user_id on public.ahorros
  for each row execute function public.assert_owned_refs();

revoke execute on function public.assert_owned_refs() from public, anon;
```

Antes de aplicar, comprobar que no haya filas existentes que violen la regla (el trigger no las toca, pero conviene saberlo):

```sql
select 'gastos', count(*) from gastos g join categorias c on c.id = g.category_id where c.user_id <> g.user_id
union all select 'ingresos', count(*) from ingresos i join categorias c on c.id = i.category_id where c.user_id <> i.user_id;
```
Expected: 0 y 0. Copiar la migración a `schema_supabase.txt`.

- [ ] **Step 7: Tests**

Run: `cd frontend/server && npm test` → Expected: PASS (todos).

- [ ] **Step 8: Commit**

```bash
git add frontend/server/src frontend/server/test/dbError.test.js schema_supabase.txt
git commit -m "Mensajes de error de BD en español, valida parámetros de consulta y bloquea categorías ajenas"
```

---

### Task 7: Deudas que nunca se terminan de pagar

**Problema:** si el pago mínimo no cubre los intereses, la simulación corta en 480 meses y la pantalla muestra "480 meses" y "Mes 480" como si fuera un plan válido.

**Files:**
- Modify: `frontend/server/src/services/engines/debtEngine.js:56-63`
- Modify: `frontend/public/js/pages/Deudas.js` (`renderComparison`, `renderOrder`)
- Create: `frontend/server/test/debtEngine.test.js`

**Interfaces:**
- Produces: `simulate(...)` devuelve además `paysOff: boolean`; `order[i].paidMonth` es `number | null` (`null` = nunca se paga).

- [ ] **Step 1: Test que falla**

Crear `frontend/server/test/debtEngine.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/services/engines/debtEngine.js";

test("deuda sin interés se paga en balance/mínimo meses", () => {
  const r = simulate([{ id: "a", name: "A", balance: 100000, rate: 0, minPayment: 10000 }], "avalanche", 0);
  assert.equal(r.months, 10);
  assert.equal(r.paysOff, true);
  assert.equal(r.order[0].paidMonth, 10);
});

test("mínimo menor que el interés → paysOff false y paidMonth null", () => {
  // 36% anual sobre 1.000.000 = 30.000/mes de interés; mínimo 20.000
  const r = simulate([{ id: "a", name: "A", balance: 1000000, rate: 36, minPayment: 20000 }], "avalanche", 0);
  assert.equal(r.paysOff, false);
  assert.equal(r.order[0].paidMonth, null);
});

test("sin deudas → 0 meses", () => {
  const r = simulate([], "snowball", 0);
  assert.equal(r.months, 0);
  assert.equal(r.paysOff, true);
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd frontend/server && npm test` → Expected: FAIL (`paysOff` es `undefined`; `paidMonth` 480).

- [ ] **Step 3: Implementar**

En `debtEngine.js` reemplazar el `return` final de `simulate` por:

```js
  return {
    months,
    // false = con estos pagos alguna deuda no se termina nunca (el mínimo
    // no cubre los intereses); la simulación se cortó en 480 meses.
    paysOff: !sim.some((d) => d.remaining > 0.5),
    totalInterest: Math.round(totalInterest),
    order: order.map((od) => ({
      ...od,
      paidMonth: (sim.find((d) => d.id === od.id) || {}).paidMonth ?? null,
    })),
  };
```

- [ ] **Step 4: Frontend**

En `Deudas.js`, `renderComparison`: reemplazar las dos ocurrencias de `` `${s.months} meses` `` y `` `${a.months} meses` `` por `s.paysOff ? `${s.months} meses` : "No se termina"` y `a.paysOff ? `${a.months} meses` : "No se termina"`. Al final de `comparisonRow.append(...)` agregar, si alguna no se paga:

```js
    if (!s.paysOff || !a.paysOff) {
      comparisonRow.append(
        h("p", { style: "grid-column:1/-1;margin:4px 0 0;font-size:12px;font-weight:600;color:var(--negative)" },
          "Con estos pagos alguna deuda no se termina: el pago mínimo no alcanza a cubrir los intereses. Aumentá el pago extra o el mínimo.")
      );
    }
```

En `renderOrder` reemplazar `` `Mes ${o.paidMonth}` `` por `o.paidMonth ? `Mes ${o.paidMonth}` : "Sin fin"`.

- [ ] **Step 5: Tests + verificación visual**

Run: `cd frontend/server && npm test` → PASS.
Manual: crear una deuda de $1.000.000 al 36% con mínimo $20.000, abrir Deudas con pago extra $100.000 → muestra meses normales; (el mensaje rojo aparece solo si el extra no alcanza — probar editando la deuda a $100.000.000).

- [ ] **Step 6: Commit**

```bash
git add frontend/server/src/services/engines/debtEngine.js frontend/server/test/debtEngine.test.js frontend/public/js/pages/Deudas.js
git commit -m "Avisa cuando una deuda no se termina de pagar con los pagos actuales"
```

---

### Task 8: Eliminar cuenta y aceptación de la política de datos

**Problema:** la Ley 1581 de 2012 (habeas data) exige que el titular pueda suprimir sus datos y que haya autorización previa para tratarlos. Hoy no existe ninguna de las dos cosas. (El borrado en cascada ya funciona desde la migración `fix_log_audit_on_user_delete`.)

**Files:**
- Modify: `frontend/server/src/routes/auth.routes.js` (endpoint + `accepted_privacy` en signup)
- Modify: `frontend/public/js/services/auth.js` (`deleteAccount`, `signup` con consentimiento)
- Modify: `frontend/public/js/components/PageHeader.js`
- Modify: `frontend/public/js/pages/Login.js`
- Create: `frontend/public/privacidad.html`, `frontend/public/terminos.html`

**Interfaces:**
- Produces: `DELETE /api/auth/account` (Bearer) → 204; `authService.deleteAccount(): Promise<void>`; `authService.signup(email, password, fullName, acceptedPrivacy: boolean)`.

- [ ] **Step 1: Endpoint de borrado**

En `auth.routes.js` agregar `import { requireAuth } from "../middlewares/auth.middleware.js";` y al final:

```js
// Supresión de datos (Ley 1581): borra el usuario de Auth; el cascade de
// las FK elimina todas sus filas en public.*.
authRouter.delete(
  "/account",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);
    if (error) throw ApiError.internal("No se pudo eliminar la cuenta. Intentá de nuevo.");
    res.status(204).send();
  })
);
```

- [ ] **Step 2: Consentimiento en el registro (backend)**

En `signupSchema` agregar:

```js
  accepted_privacy: z.literal(true, { errorMap: () => ({ message: "Debés aceptar la política de tratamiento de datos" }) }),
```

y en `createUser` cambiar `user_metadata: { full_name }` por `user_metadata: { full_name, privacy_accepted_at: new Date().toISOString() }`; desestructurar solo `{ email, password, full_name }` como hoy.

> Nota zod v4 (Tarea 9): `errorMap` pasa a `{ error: "..." }`. La Tarea 9 lo ajusta.

- [ ] **Step 3: authService**

En `auth.js` cambiar `signup`:

```js
  async signup(email, password, fullName, acceptedPrivacy) {
    const data = await request("signup", { email, password, full_name: fullName, accepted_privacy: acceptedPrivacy });
    if (data.session) persistSession(data.session);
    return data;
  },
```

y agregar:

```js
  async deleteAccount() {
    const session = store.state.session;
    const res = await fetch(`${API_BASE_URL}/auth/account`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (!res.ok && res.status !== 204) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error?.message || "No se pudo eliminar la cuenta");
    }
    persistSession(null);
  },
```

- [ ] **Step 4: Checkbox en Login.js**

Después de `const passwordLabel = ...` agregar:

```js
  const privacyCheck = h("input", { type: "checkbox", id: "accept-privacy" });
  const privacyRow = h("label", { for: "accept-privacy", class: "field-label", style: "display:none;gap:8px;align-items:flex-start;text-transform:none" }, [
    privacyCheck,
    h("span", {}, [
      "Acepto la ",
      h("a", { href: "./privacidad.html", target: "_blank", rel: "noopener" }, "política de tratamiento de datos"),
      " y los ",
      h("a", { href: "./terminos.html", target: "_blank", rel: "noopener" }, "términos de uso"),
      ".",
    ]),
  ]);
```

En `applyMode()` agregar `privacyRow.style.display = mode === "signup" ? "flex" : "none"; privacyCheck.checked = false;`.
En `onSubmit`, dentro del `if (mode === "signup" ...)` existente agregar antes un chequeo:

```js
        if (mode === "signup" && !privacyCheck.checked) {
          errorEl.textContent = "Para crear la cuenta tenés que aceptar la política de tratamiento de datos.";
          return;
        }
```

Cambiar la llamada a `authService.signup(emailField.value, passwordField.value, nameField.value, privacyCheck.checked)` e insertar `privacyRow` en el arreglo de hijos del form justo después de `passwordRules.el`.

- [ ] **Step 5: Botón "Eliminar cuenta" en PageHeader**

En `PageHeader.js` agregar:

```js
async function handleDeleteAccountClick() {
  const ok = await confirmAction({
    title: "¿Eliminar tu cuenta?",
    message: "Se borran para siempre tus ingresos, gastos, deudas, metas e historial. No se puede deshacer.",
    confirmLabel: "Eliminar cuenta",
    danger: true,
  });
  if (!ok) return;
  const sure = await confirmAction({
    title: "Confirmá de nuevo",
    message: "Última confirmación: tu cuenta y todos tus datos se eliminarán ahora.",
    confirmLabel: "Sí, eliminar todo",
    danger: true,
  });
  if (!sure) return;
  try {
    await authService.deleteAccount();
    showToast("Tu cuenta fue eliminada.");
    navigate("/login");
  } catch (err) {
    showToast(err.message);
  }
}
```

(import `showToast` de `./Toast.js`) y en el header, antes del botón de cerrar sesión:

```js
      IconButton({ iconName: "user", onClick: handleDeleteAccountClick, ariaLabel: "Eliminar cuenta" }),
```

- [ ] **Step 6: Páginas legales**

Crear `frontend/public/privacidad.html` (y `terminos.html` igual cambiando título y encabezado):

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Política de tratamiento de datos — bolsillo.</title>
<link rel="stylesheet" href="./assets/css/build.css" />
</head>
<body style="max-width:720px;margin:0 auto;padding:24px 16px;line-height:1.6">
<h1>Política de tratamiento de datos personales</h1>
<!-- Pegar aquí el texto generado en TermsFeed/Termly (Fase 0.6) -->
<p><a href="./">Volver a bolsillo.</a></p>
</body>
</html>
```

- [ ] **Step 7: Verificación**

Local: en registro, sin marcar el checkbox → muestra el error; marcado → crea la cuenta. Con la sesión abierta, ícono de usuario → dos confirmaciones → vuelve al login; volver a entrar con ese correo → "Correo o contraseña incorrectos." (El smoke test de la Tarea 10 también cubre el endpoint.)

- [ ] **Step 8: Commit**

```bash
git add frontend/server/src/routes/auth.routes.js frontend/public/js/services/auth.js frontend/public/js/components/PageHeader.js frontend/public/js/pages/Login.js frontend/public/privacidad.html frontend/public/terminos.html
git commit -m "Agrega eliminación de cuenta y aceptación de la política de datos al registrarse"
```

---

### Task 9: Actualizar zod a v4

**Problema:** `npm audit` reporta zod < 4.6.6 (alto: agotamiento de memoria). Ya mitigado con `.max(20)` en tags, pero es la última vulnerabilidad abierta.

**Files:**
- Create: `frontend/server/test/validators.test.js`
- Modify: `frontend/package.json`, `frontend/server/package.json` (+ lockfiles)
- Modify: `frontend/server/src/routes/auth.routes.js` (sintaxis `errorMap` → `error`)

- [ ] **Step 1: Tests de los validadores (deben pasar con v3)**

Crear `frontend/server/test/validators.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { expenseSchema, quickIncomeSchema, goalSchema, dateRangeQuerySchema, debtStrategyQuerySchema } from "../src/validators/index.js";

const UUID = "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b";

test("gasto válido pasa y descarta user_id ajeno", () => {
  const r = expenseSchema.safeParse({ category_id: UUID, amount: 1000, user_id: "otro" });
  assert.equal(r.success, true);
  assert.equal("user_id" in r.data, false);
});

test("monto negativo o cero falla", () => {
  assert.equal(expenseSchema.safeParse({ amount: 0 }).success, false);
  assert.equal(expenseSchema.safeParse({ amount: -5 }).success, false);
});

test("más de 20 tags falla", () => {
  assert.equal(expenseSchema.safeParse({ amount: 1, tags: Array(21).fill("x") }).success, false);
});

test("porcentajes de asignación entre 0 y 100", () => {
  assert.equal(quickIncomeSchema.safeParse({ category_id: UUID, amount: 1, allocate_investment_pct: 101 }).success, false);
});

test("meta con fecha mal formada falla", () => {
  assert.equal(goalSchema.safeParse({ name: "x", target_amount: 1, target_date: "13/11/2026" }).success, false);
});

test("query de rango y pago extra", () => {
  assert.equal(dateRangeQuerySchema.safeParse({ start: "x" }).success, false);
  assert.equal(debtStrategyQuerySchema.parse({ extraPayment: "200000" }).extraPayment, 200000);
  assert.equal(debtStrategyQuerySchema.parse({}).extraPayment, 0);
});
```

Run: `cd frontend/server && npm test` → Expected: PASS (todavía con v3).

- [ ] **Step 2: Subir zod en ambos package.json**

```bash
cd frontend/server && npm install zod@^4.6.7
cd .. && npm install zod@^4.6.7
```

- [ ] **Step 3: Ajustar sintaxis v4**

En `auth.routes.js` cambiar `z.literal(true, { errorMap: () => ({ message: "Debés aceptar la política de tratamiento de datos" }) })` por `z.literal(true, { error: "Debés aceptar la política de tratamiento de datos" })`.
`result.error.flatten()` en `validate.middleware.js` sigue funcionando en v4 (deprecado, no eliminado) — no tocar.

- [ ] **Step 4: Tests + audit**

Run: `cd frontend/server && npm test` → PASS.
Run: `cd frontend && npm audit --omit=dev && cd server && npm audit --omit=dev` → Expected: `found 0 vulnerabilities` en ambos.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/server/package.json frontend/server/package-lock.json frontend/server/test/validators.test.js frontend/server/src/routes/auth.routes.js
git commit -m "Actualiza zod a v4 (cierra la última vulnerabilidad de npm audit)"
```

---

### Task 10: Prueba de humo end-to-end, deploy y verificación en producción

**Files:**
- Create: `frontend/server/scripts/smoke-test.sh`

- [ ] **Step 1: Crear el script**

```bash
#!/usr/bin/env bash
# Prueba de humo contra un entorno real. Crea un usuario temporal, ejercita
# los flujos de dinero y lo elimina al final con DELETE /api/auth/account.
# Uso: scripts/smoke-test.sh http://localhost:3001   |   scripts/smoke-test.sh https://bolsilloapp.vercel.app
set -euo pipefail
BASE="${1:?Uso: smoke-test.sh <url-base>}"
API="$BASE/api"
H='content-type: application/json'
EMAIL="smoke-$(date +%s)@example.com"
PASS="Smoke$(date +%s)!"

fail() { echo "FALLÓ: $1"; exit 1; }
expect() { [ "$2" = "$3" ] || fail "$1 → esperado $3, recibido $2"; echo "ok  $1"; }
json() { python3 -c "import json,sys;d=json.load(sys.stdin);print($1)"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

TOK=$(curl -s -X POST "$API/auth/signup" -H "$H" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"full_name\":\"Smoke\",\"accepted_privacy\":true}" \
  | json "d['data']['session']['access_token']")
A="Authorization: Bearer $TOK"
trap 'curl -s -o /dev/null -X DELETE "$API/auth/account" -H "$A" || true' ERR

for p in /dashboard/summary /analytics/monthly /categories /settings /debts/strategy /goals /alerts; do
  expect "GET $p" "$(code "$API$p" -H "$A")" 200
done

ECAT=$(curl -s "$API/categories" -H "$A" | json "[c['id'] for c in d['data'] if c['kind']=='expense'][0]")
ICAT=$(curl -s "$API/categories" -H "$A" | json "[c['id'] for c in d['data'] if c['kind']=='income'][0]")

expect "gasto rápido" "$(code -X POST "$API/transactions/quick-expense" -H "$A" -H "$H" -d "{\"category_id\":\"$ECAT\",\"amount\":1000}")" 201
GOAL=$(curl -s -X POST "$API/goals" -H "$A" -H "$H" -d '{"name":"Fondo","target_amount":100000,"is_emergency_fund":true}' | json "d['data']['id']")
expect "segundo fondo de emergencia" "$(code -X POST "$API/goals" -H "$A" -H "$H" -d '{"name":"Otro","target_amount":1,"is_emergency_fund":true}')" 409
expect "abono a meta" "$(code -X POST "$API/goals/$GOAL/contribute" -H "$A" -H "$H" -d '{"amount":5000}')" 201
expect "ingreso con asignaciones" "$(code -X POST "$API/transactions/quick-income" -H "$A" -H "$H" -d "{\"category_id\":\"$ICAT\",\"amount\":100000,\"allocate_emergency_fund_pct\":10,\"allocate_investment_pct\":5}")" 201

# 100000 ingreso − 1000 gasto − (5000 + 10000) en meta − 5000 invertido = 79000
expect "saldo disponible" "$(curl -s "$API/dashboard/summary" -H "$A" | json "int(d['data']['balance'])")" 79000

expect "categoría ajena" "$(code -X POST "$API/expenses" -H "$A" -H "$H" -d '{"category_id":"00000000-0000-4000-8000-000000000000","amount":10}')" 400
expect "id inválido" "$(code "$API/goals/no-es-uuid" -H "$A")" 400
expect "rango inválido" "$(code "$API/expenses?start=x&end=y" -H "$A")" 400

expect "eliminar cuenta" "$(code -X DELETE "$API/auth/account" -H "$A")" 204
expect "token tras eliminar" "$(code "$API/dashboard/summary" -H "$A")" 401
echo "TODO OK"
```

`chmod +x frontend/server/scripts/smoke-test.sh`

- [ ] **Step 2: Local**

Run: `cd frontend/server && npm test && PORT=3001 npm start &` y luego `scripts/smoke-test.sh http://localhost:3001`
Expected: todas las líneas `ok` y `TODO OK`. Detener el server.

- [ ] **Step 3: Commit + push (dispara el deploy)**

```bash
git add frontend/server/scripts/smoke-test.sh
git commit -m "Agrega prueba de humo end-to-end"
git push origin main
```

- [ ] **Step 4: Producción**

Run: `vercel ls bolsilloapp | head -5` hasta ver el deploy nuevo en `● Ready`.
Run: `frontend/server/scripts/smoke-test.sh https://bolsilloapp.vercel.app` → Expected: `TODO OK`.
Run: `mcp__supabase__get_advisors` (security y performance) → Expected: solo el aviso de contraseñas filtradas si 0.4 aún no se hizo.
Abrir `https://bolsilloapp.vercel.app` en el navegador → login carga, sin errores de CSP en consola.

---

## Anexo: hallazgos que originan este plan

| # | Hallazgo | Severidad | Tarea |
|---|---|---|---|
| 1 | Supabase gratis se pausa a los 7 días y no tiene backups | Crítico (operación) | 0.1 |
| 2 | Correos de recuperación no llegan al público (SMTP por defecto) | Crítico (funcional) | 0.2–0.3 |
| 3 | Sesión expira cada hora y expulsa al usuario | Alto | 2 |
| 4 | Fechas en UTC: gastos de la noche quedan con el día siguiente | Alto | 1 |
| 5 | Rate limit por IP bloquea usuarios tras CGNAT/oficinas | Alto | 3 |
| 6 | Saldo calculado en JS con tope de 1000 filas y errores ignorados | Alto | 4 |
| 7 | Abonos/aportes no atómicos (doble toque pierde dinero) | Medio | 5 |
| 8 | Dos fondos de emergencia rompen el ingreso rápido | Medio | 5 |
| 9 | Mensajes crudos de Postgres al usuario | Medio | 6 |
| 10 | `category_id` de otra cuenta aceptado | Bajo | 6 |
| 11 | Deudas impagables mostradas como "480 meses" | Bajo | 7 |
| 12 | Sin borrado de cuenta ni consentimiento (Ley 1581) | Alto (legal) | 8, 0.6 |
| 13 | zod con vulnerabilidad alta | Medio (mitigado) | 9 |
| 14 | Registro sin verificar correo | Decisión | 0.5 |

Ya verificado el 2026-11-13: deploy `819615b` en `● Ready`, variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL`, `NODE_ENV` presentes en Production y Preview; flujo completo (registro, dashboard, analítica, categorías, ajustes, deudas, metas, alertas, gasto) responde 200/201 en producción; headers CSP/HSTS activos y sin errores en consola.
