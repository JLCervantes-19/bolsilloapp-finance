# Bolsillos múltiples — diseño

Fuente: pedido del dueño del producto del 2026-11-13 ("ACTUALIZACIÓN: Sistema de Bolsillos múltiples").
Rama: `bolsillos-multiples`. Push solo con autorización explícita (push = deploy a producción).

## Lo que hay hoy (resumen de exploración)

- SPA vanilla JS (`frontend/public`), router por hash con rutas exactas, store reactivo mínimo, Tailwind v4 compilado a `build.css` (se commitea; Vercel no compila).
- API Express 5 (`frontend/server/src`) como función serverless; cada consulta de negocio usa el JWT del usuario (RLS).
- Postgres (Supabase) con tablas en español y columnas en inglés: `ingresos` y `gastos` son tablas separadas (no hay una tabla única de movimientos), `categorias` por usuario (9 por defecto + 3 personalizadas), `metas`/`ahorros`/`inversiones`/`deudas`/`presupuestos` como herramientas de finanzas personales.
- Saldo disponible = ingresos − gastos − ahorrado en metas − invertido (función `get_balance_totals`).
- Producción: 2 usuarios reales. Foto de totales tomada antes de migrar (saldos $30 y $16.000).

## Decisiones

1. **Tabla `bolsillos`** (`name`, `kind` personal|business, `color`, `icon` emoji, `currency`, `initial_balance`, `is_default`, `archived_at`, `position`). Un único `is_default` por usuario (índice único parcial); no se puede borrar, archivar ni cambiar de tipo (trigger); sí renombrar/recolorear.
2. **Movimientos:** se conservan `ingresos` y `gastos` (cero riesgo para lo existente) y se les agrega `bolsillo_id NOT NULL`. Inversión, retiro y transferencia viven en **una tabla nueva `transferencias`** con un único registro y ambos extremos (`from_bolsillo_id`, `to_bolsillo_id`) y `kind`:
   - `aporte` (inversión de capital): destino = negocio; origen opcional (null = dinero que viene de fuera; un bolsillo = sale de ahí).
   - `retiro`: origen = negocio; destino opcional (null = el dueño se lo lleva; un bolsillo personal = transferencia enlazada).
   - `traslado`: ambos extremos, distintos.
   Como nunca son filas de `ingresos`/`gastos`, **por construcción jamás suman en ingresos ni gastos** (ni por bolsillo ni consolidados): la regla anti-doble-conteo no depende de filtros.
3. **Una vista `movimientos`** (security_invoker) une las tres fuentes para el historial: cada transferencia aparece una vez por extremo (entrada/salida) con `principal = true` en un solo lado, que es el que se usa en el consolidado.
4. **Categorías por bolsillo** (`categorias.bolsillo_id`). Las existentes pasan al bolsillo personal. Bolsillos nuevos se siembran con categorías según su tipo (negocio: Ventas, Servicios, Abonos de clientes / Mercancía, Arriendo, Servicios públicos, Transporte, Nómina, Comisiones, Pérdidas). El tope de 3 personalizadas pasa a ser por bolsillo.
5. **Cálculo central único:** función SQL `bolsillos_resumen(desde, hasta)` devuelve por bolsillo saldo y totales; `services/pockets.service.js` deriva utilidad, capital, ROI y el consolidado. Nadie más calcula saldos.
   - `saldo(b) = saldo_inicial + ingresos − gastos + entradas − salidas − (si es el predeterminado: ahorrado en metas + invertido en portafolio)`. Para los usuarios actuales (sin saldo inicial ni transferencias) es exactamente el saldo disponible de hoy.
   - Consolidado: patrimonio = Σ saldos; ingresos/gastos globales = Σ de `ingresos`/`gastos` (las transferencias no están ahí).
   - Negocio: utilidad = ingresos − egresos; capital invertido = saldo inicial + aportes; retiros acumulados; rentabilidad = utilidad acumulada / capital invertido.
6. **Compatibilidad con el código en producción mientras la rama no se publica:** las migraciones se aplican al único proyecto Supabase (no hay staging). Por eso todo es aditivo: un trigger completa `bolsillo_id` con el bolsillo predeterminado cuando no viene (el frontend actual no lo envía), las funciones existentes no cambian de firma y `handle_new_user` crea el bolsillo personal.
7. **Selección de bolsillo** en el store + `localStorage` por usuario; las rutas actuales (`#/dashboard`, `#/gastos`, `#/deudas`, `#/ahorros`, `#/analitica`) siguen existiendo y se filtran por el bolsillo activo. La API recibe `?bolsillo=<id>`; sin parámetro mantiene el comportamiento actual (todo el usuario).

## Desviaciones del pedido (y por qué)

- **No hay una única tabla de movimientos con un campo tipo**: migrar `ingresos`/`gastos` a una tabla nueva era el cambio más riesgoso para datos en producción. La vista `movimientos` da el historial unificado sin mover datos.
- **Deudas, Ahorros y metas, Inversiones de portafolio y Presupuestos siguen siendo herramientas personales** (del bolsillo personal predeterminado), no por bolsillo. Llevarlas a negocios es una ampliación futura; hoy su lógica (fondo de emergencia, asignación automática del 10%/5%) es puramente personal.
- **Adjuntos**: no se implementan (requiere Storage, tecnología nueva). Queda la descripción como nota.
- **Moneda**: se guarda por bolsillo y se muestra, pero no hay conversión; el consolidado avisa si hay bolsillos en monedas distintas.
- **Persistencia de la selección**: por dispositivo (`localStorage`), no entre dispositivos.

## Reversibilidad

`supabase/rollback/2026-11-13-bolsillos-down.sql` elimina todo lo agregado (vista, funciones, triggers, tabla `transferencias`, columnas `bolsillo_id`/`payment_method`, tabla `bolsillos`) y restaura `handle_new_user` y `assert_owned_refs`. Los datos de `ingresos`/`gastos`/`categorias` nunca se mueven ni se copian, solo se etiquetan; las transferencias creadas después se perderían al revertir (son datos nuevos).

## Implementación (estado al cierre)

**API nueva** (`frontend/server/src`):
- `GET /pockets` (saldos + métricas del mes), `GET /pockets/:id`, `GET /pockets/:id/overview` (serie 6 meses + desglose por categoría), `GET /pockets/consolidated`, `POST /pockets`, `PATCH /pockets/:id` (renombrar, color, ícono, moneda, `archived`), `DELETE /pockets/:id` con `{ destino? , borrar_movimientos? }`.
- `GET/POST/PATCH/DELETE /transfers` (aporte, retiro, traslado; editar solo monto/fecha/nota/método).
- `GET /movements?bolsillo&tipo&start&end&categoria&metodo&q&page&pageSize` (vista `movimientos`; sin bolsillo = consolidado con `principal`).
- `?bolsillo=` opcional en `/dashboard/summary`, `/analytics/monthly`, `/incomes`, `/expenses`, `/categories`; `bolsillo_id` y `payment_method` opcionales al registrar. La asignación automática (10 % / 5 %) solo aplica al bolsillo personal predeterminado.
- Cálculo central: `services/pockets.service.js` (sobre `bolsillos_resumen`). Pruebas: `test/pockets.test.js`; prueba de humo ampliada.

**Frontend** (`frontend/public/js`):
- Estado: `services/pocketState.js` (bolsillo activo por usuario en `localStorage`, pestañas por tipo).
- Navegación: `components/PocketPanel.js` (Todo/Consolidado, lista con saldo, "Ver todos", archivados, "+ Agregar bolsillo"), `Sidebar.js` colapsable, `PocketBar.js` + hoja inferior en móvil, `PocketTabs.js` (Resumen · Ingresos · Gastos/Egresos · Inversión · Retiros · Movimientos).
- Páginas: `Home.js` (consolidado / dashboard personal de siempre / resumen de negocio), `Gastos.js` (gastos e ingresos), `Movimientos.js` (historial con filtros, paginación, edición y borrado; también pestañas Inversión y Retiros).
- Formularios: `QuickAddForm.js` (bolsillo + 5 tipos, método de pago, fecha, nota), `PocketForm.js` (crear/editar, archivar, eliminar moviendo movimientos).
- Tinte del bolsillo activo: franja superior, halo, pestaña activa y fila del panel con su color.
- Rutas nuevas: `#/ingresos`, `#/inversion`, `#/retiros`, `#/movimientos`. Deudas, Ahorros y Analítica quedan como "Finanzas personales" sobre el bolsillo predeterminado.
