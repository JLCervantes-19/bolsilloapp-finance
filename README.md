# bolsillo.

Asistente financiero personal — Node 24 + Express 5 (Clean Architecture) sobre
Supabase Postgres con RLS, frontend Vanilla JS + Tailwind v4 con sistema de
diseño "Liquid Glass".

## Estructura

```
api/index.js       — entrypoint serverless de Vercel (envuelve backend/src/app.js)
backend/            — API Express (fuente de verdad; también corre standalone en local)
frontend/           — SPA estática (Tailwind v4 + Vanilla JS ES Modules)
schema_supabase.txt — schema SQL completo (12 tablas + RLS), ya aplicado al proyecto Supabase
vercel.json         — build de frontend + rewrite de /api/* al backend serverless
```

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

Un solo proyecto de Vercel sirve **frontend + backend**:

- `outputDirectory` (`frontend/public`) se sirve como sitio estático.
- `api/index.js` se despliega como función serverless — Vercel enruta todo
  `/api/*` ahí (ver `vercel.json`), así que el frontend llama a `/api/...`
  en el mismo origen (`frontend/public/js/services/config.js` ya lo asume:
  en `localhost` usa `http://localhost:3001/api`, en cualquier otro host
  usa `/api` same-origin).

### Variables de entorno a configurar en el dashboard de Vercel

(Project Settings → Environment Variables — **nunca** en el repo)

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | `https://tsjzybxgaeltxhnkqpry.supabase.co` |
| `SUPABASE_ANON_KEY` | anon key del proyecto `bolsillo-app` en Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key del proyecto (¡secreta!) |
| `CORS_ORIGIN` | el dominio de producción de Vercel (p. ej. `https://bolsilloapp-finance.vercel.app`) — el CORS del backend es fail-closed: sin este valor, bloquea todo origen cross-site. Como frontend y backend quedan en el mismo dominio, esto es una capa de defensa extra, no estrictamente necesaria para que la app funcione. |
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
