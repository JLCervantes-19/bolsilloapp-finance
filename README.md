# bolsillo.

Asistente financiero personal — Node 24 + Express 5 (Clean Architecture) sobre
Supabase Postgres con RLS, frontend Vanilla JS + Tailwind v4 con sistema de
diseño "Liquid Glass".

## Estructura

```
frontend/
  server/               — API Express (Clean Architecture) — antes vivía en /backend,
                           ahora adentro de frontend/ a propósito (ver nota abajo)
  api/index.js           — entrypoint serverless de Vercel (envuelve ../server/src/app.js)
  public/                 — SPA estática (Tailwind v4 + Vanilla JS ES Modules)
  package.json            — deps de Tailwind + las mismas deps runtime de server/package.json
  vercel.json             — no está acá, vive en la raíz del repo (ver abajo)
vercel.json           — builds/routes explícito: frontend/public como estático,
                         frontend/api/index.js como función serverless
schema_supabase.txt   — schema SQL completo (12 tablas + RLS), ya aplicado al proyecto Supabase
```

**Por qué el backend vive adentro de `frontend/server/` y no en un `/backend`
suelto:** Node resuelve `node_modules` subiendo por los directorios padre
del archivo que hace el `import`, y en Vercel solo se instala
`frontend/node_modules` (para la función `frontend/api/index.js`). Un
`backend/` fuera del árbol de `frontend/` nunca puede resolver sus propias
dependencias (`express`, `@supabase/supabase-js`, etc.) en producción —
localmente parecía funcionar porque `backend/node_modules` existía ahí
suelto de instalarlo a mano, pero en Vercel (que solo corre `npm install`
adentro de `frontend/`) tronaba en tiempo de ejecución con
`Cannot find package 'express'`. Server adentro de `frontend/` resuelve
esto de raíz: cualquier archivo bajo `frontend/` encuentra
`frontend/node_modules` subiendo por sus directorios padre.

**Por qué `vercel.json` usa el formato clásico `builds`/`routes` en vez de
`buildCommand`/`outputDirectory`:** el proyecto de Vercel llegó a tener un
Build Command explícito pegado en el dashboard (de una configuración
anterior) que le ganaba a cualquier cambio en `vercel.json` — el formato
`builds` es la única forma de que el propio `vercel.json` sea la fuente de
verdad completa, sin depender de nada configurado a mano en el dashboard.

## Desarrollo local

```bash
# Backend (puerto 3001)
cd frontend/server
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

Un solo proyecto de Vercel sirve **frontend + backend** — `vercel.json` en
la raíz del repo define todo explícitamente:

- `frontend/public/**` se despliega como sitio estático.
- `frontend/api/index.js` se despliega como función serverless (Node) —
  Vercel enruta todo `/api/*` ahí, así que el frontend llama a `/api/...`
  en el mismo origen (`frontend/public/js/services/config.js` ya lo asume:
  en `localhost` usa `http://localhost:3001/api`, en cualquier otro host
  usa `/api` same-origin).

Si el proyecto de Vercel se recrea desde cero, en la pantalla de
configuración previa al primer deploy conviene dejar **Root Directory
vacío** y no tocar Build/Install/Output Command — con `builds`/`routes` en
`vercel.json`, esos campos no se usan para nada.

### Variables de entorno a configurar en el dashboard de Vercel

(Project Settings → Environment Variables — **nunca** en el repo)

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | `https://tsjzybxgaeltxhnkqpry.supabase.co` |
| `SUPABASE_ANON_KEY` | anon key del proyecto `bolsillo-app` en Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key del proyecto (¡secreta!) |
| `CORS_ORIGIN` | el dominio de producción de Vercel — opcional, dejar vacío no rompe nada porque frontend y backend quedan same-origin; el CORS del backend es fail-closed sin este valor. |
| `NODE_ENV` | `production` |

Sin `SUPABASE_SERVICE_ROLE_KEY` configurada, la función serverless falla al
arrancar (`env.js` valida las variables requeridas de forma explícita —
fail-fast intencional, no un bug). Ojo al pegar los valores: un espacio o
salto de línea de más alcanza para tumbar la función entera al arrancar
(`env.js` los recorta con `.trim()` como defensa, pero mejor pegarlos limpios).

### Qué no se subió al repo (y por qué)

- `node_modules/` — se reinstala en cada build.
- `.env` — secretos; van solo en el dashboard de Vercel.
- `graphify-out/` — salida generada del grafo de conocimiento del proyecto, no la usa la app.
- `_ds/`, `screenshots/`, `Bolsillo App.dc.html`, `support.js` — el prototipo
  visual original y su runtime de preview; la app real en `frontend/` no
  depende de ninguno de estos archivos (verificado — cero referencias en el
  código fuente).
