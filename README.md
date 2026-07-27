# bolsillo.

Asistente financiero personal — Node 24 + Express 5 (Clean Architecture) sobre
Supabase Postgres con RLS, frontend Vanilla JS + Tailwind v4 con sistema de
diseño "Liquid Glass".

## Estructura

```
backend/             — API Express (fuente de verdad; corre standalone en local)
frontend/             — raíz del proyecto de Vercel
  api/index.js         — entrypoint serverless (envuelve ../../backend/src/app.js)
  public/               — SPA estática (Tailwind v4 + Vanilla JS ES Modules)
  package.json          — deps de Tailwind + las mismas deps runtime de backend/package.json
                           (Vercel resuelve node_modules de la función api/ desde el
                           package.json más cercano — por eso están duplicadas acá)
  vercel.json            — build del frontend + rewrite de /api/* a la función serverless
schema_supabase.txt  — schema SQL completo (12 tablas + RLS), ya aplicado al proyecto Supabase
```

**Por qué `frontend/` es la raíz de Vercel y no el repo entero:** el proyecto
de Vercel quedó creado con el *Root Directory* apuntando a `frontend/` (no se
pudo cambiar de forma persistente desde el dashboard). En vez de pelear con
esa configuración, el repo se acomodó a ella — `api/` y `vercel.json` viven
adentro de `frontend/`, así que sea cual sea el Root Directory real, coincide
con la estructura del repo.

## Desarrollo local

```bash
# Backend (puerto 3001)
cd backend
cp .env.example .env   # completar SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev

# Frontend (puerto 5173), en otra terminal
cd frontend
npm install
npm run build:css      # o npm run dev:css para watch mode
npm run serve
```

## Despliegue en Vercel

Un solo proyecto de Vercel sirve **frontend + backend**, con Root Directory
= `frontend`:

- `outputDirectory` (`public`, relativo a `frontend/`) se sirve como sitio estático.
- `frontend/api/index.js` se despliega como función serverless — Vercel
  enruta todo `/api/*` ahí (ver `frontend/vercel.json`), así que el frontend
  llama a `/api/...` en el mismo origen
  (`frontend/public/js/services/config.js` ya lo asume: en `localhost` usa
  `http://localhost:3001/api`, en cualquier otro host usa `/api` same-origin).

### Variables de entorno a configurar en el dashboard de Vercel

(Project Settings → Environment Variables — **nunca** en el repo)

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | `https://tsjzybxgaeltxhnkqpry.supabase.co` |
| `SUPABASE_ANON_KEY` | anon key del proyecto `bolsillo-app` en Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key del proyecto (¡secreta!) |
| `CORS_ORIGIN` | el dominio de producción de Vercel — opcional, dejar vacío no rompe nada porque frontend y backend quedan same-origin (ver conversación); el CORS del backend es fail-closed sin este valor. |
| `NODE_ENV` | `production` |

Sin `SUPABASE_SERVICE_ROLE_KEY` configurada, la función serverless falla al
arrancar (`env.js` valida las variables requeridas de forma explícita —
fail-fast intencional, no un bug).

### Qué no se subió al repo (y por qué)

- `node_modules/` — se reinstala en cada build.
- `.env` — secretos; van solo en el dashboard de Vercel.
- `graphify-out/` — salida generada del grafo de conocimiento del proyecto, no la usa la app.
- `_ds/`, `screenshots/`, `Bolsillo App.dc.html`, `support.js` — el prototipo
  visual original y su runtime de preview; la app real en `frontend/` no
  depende de ninguno de estos archivos (verificado — cero referencias en el
  código fuente).
