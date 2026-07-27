# bolsillo-backend

API REST para **bolsillo.** — Node 24 + Express 5, Clean Architecture
(routes → controllers → services → repositories), sobre el proyecto
Supabase `bolsillo-app` (`tsjzybxgaeltxhnkqpry`).

## Setup

```bash
cd backend
cp .env.example .env   # completar SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

Las keys están en el panel de Supabase → Project settings → API del
proyecto `bolsillo-app`.

## Arquitectura

```
src/
  config/        env.js, supabase.js (2 clientes, ver "Modelo de auth")
  middlewares/   auth, validate (zod), error handler, rate limit (en app.js)
  routes/        un router por recurso, todo montado bajo requireAuth
  controllers/   delgados — parsean req, llaman al service/repositorio, responden
  services/      lógica de negocio + los 3 engines
    engines/     financialEngine, debtEngine, recommendationEngine
  repositories/  una función por tabla; CRUD genérico vía crud.factory
  validators/    schemas zod, uno por recurso
  utils/         ApiError, asyncHandler, formatters, dateRange
```

## Modelo de auth

El backend **no gestiona sesiones propias** — delega 100% en Supabase Auth.
Cada request autenticado trae `Authorization: Bearer <access_token>` (el
JWT que el frontend recibe de `supabase.auth.signInWithPassword`).
`middlewares/auth.middleware.js` verifica ese token y crea un cliente
Supabase **scoped a ese usuario** (`config/supabase.js#createRequestClient`):
como Postgres tiene RLS con `user_id = auth.uid()` en las 12 tablas, cada
query ya solo puede tocar las filas del usuario dueño del token — los
repositorios no repiten ese filtro a mano, la base de datos lo garantiza.

La `service_role` key **solo** se usa para `auth.getUser(token)` al
verificar el token entrante; nunca para leer/escribir datos de negocio.

`routes/auth.routes.js` es una capa delgada opcional sobre
`signUp`/`signInWithPassword`/`refreshSession` — el frontend también puede
llamar a `supabase-js` directo si prefiere no pasar por el backend para
login.

## Engines (portados 1:1 desde `Bolsillo App.dc.html`)

- `financialEngine.js` — `computeNetWorth`, `computeHealthScore` (mismo
  scoring 0-100 que el prototipo: `45 + tasa_ahorro*120 - ratio_deuda*40 +
  min(meses_fondo_emergencia,6)*3`).
- `debtEngine.js` — `simulate(debts, strategy, extraPayment)`: la misma
  simulación mes a mes con interés compuesto mensual que usa el prototipo
  para comparar bola de nieve vs. avalancha.
- `recommendationEngine.js` — mismas 4 reglas de recomendación (tasa de
  ahorro, categoría con mayor alza, cobertura del fondo de emergencia,
  ratio deuda/ingreso), pero comparando contra el mes calendario anterior
  real en vez de un `categoryBaseline` hardcodeado.

## Decisiones de modelado que no estaban en el prompt original

- **No existe tabla `accounts`.** El prompt maestro no la pidió y el
  schema (Fase 1, ya aplicado) tampoco la incluye. "Saldo disponible" se
  calcula (`dashboard.service.js#computeAvailableBalance`) como
  `ingresos históricos − gastos históricos − ahorro apartado − invertido`,
  no es un número que el usuario edite directamente.
- **"Evolución del patrimonio" es una aproximación documentada.** No hay
  snapshots históricos de patrimonio; el último punto de la serie es el
  patrimonio real de hoy, y los puntos anteriores se reconstruyen restando
  el flujo de caja neto mes a mes hacia atrás (`analytics.service.js`).
  Para una serie 100% exacta haría falta una tabla de snapshots periódicos
  — no incluida porque tampoco estaba en el alcance de la Fase 1.
- **"Fijos vs. variables"** usa la columna real `expenses.is_fixed`, no un
  set de categorías hardcodeado como en el mockup.

## Endpoints principales

| Método | Ruta                              | Qué hace |
|---|---|---|
| POST | `/api/auth/signup` / `/login` / `/refresh` / `/logout` | capa delgada sobre Supabase Auth |
| GET  | `/api/dashboard/summary` | los 10 indicadores + recomendaciones, todo en una llamada |
| GET  | `/api/analytics/monthly?months=6` | series para las 4 gráficas Chart.js |
| GET/POST/PATCH/DELETE | `/api/{expenses,incomes,debts,goals,budgets,savings,investments,categories}` | CRUD estándar |
| GET  | `/api/debts/strategy?extraPayment=200000` | comparación bola de nieve vs. avalancha |
| POST | `/api/goals/:id/contribute` | abonar a una meta |
| POST | `/api/transactions/quick-expense` / `quick-income` | el flujo del bottom sheet, con asignación automática a fondo de emergencia / inversión |
| GET  | `/api/alerts` · POST `/api/alerts/generate` · PATCH `/:id/read` | feed de notificaciones persistido |
| GET/PATCH | `/api/settings` | settings + perfil |

## Verificación

```bash
npm run dev
curl http://localhost:3001/health
# -> {"status":"ok","env":"development"}
```

Para probar un endpoint autenticado hace falta un `access_token` real: crear
un usuario con `/api/auth/signup`, usar el `access_token` de la respuesta
como `Authorization: Bearer ...` contra `/api/dashboard/summary` (debería
devolver todo en cero — el trigger `handle_new_user` ya sembró perfil,
settings y categorías por defecto).
