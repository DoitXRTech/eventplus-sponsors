# EventPlus Sponsors (StartCo Patrocinios), demo conectado a Supabase 

Plataforma de patrocinios del evento: el equipo de StartCo lleva cada patrocinio de kickoff a
post-evento (pipeline, piezas para aprobar, contrato, propuesta, compromisos, inscritos,
apadrinamientos, datos legales, conversación) y cada patrocinador tiene su portal para aprobar,
pedir cambios, subir documentos e inscribir gente. Parte del prototipo hecho con Claude
(`knowledge-base/.../startco-patrocinios-prototipo`) y lo vuelve una app real sobre Supabase.

Stack: Vite 5, React 18, Tailwind 3, `@supabase/supabase-js`. Auth por email y clave, permisos
por RLS en Postgres, archivos en un bucket privado con URLs firmadas de 10 minutos.

## Ponerlo en vivo (proyecto `mxndudrespjvnywypwhn`)

1. Credenciales en `~/jarvis-workspace/tools/supabase/.supabase.env` con
   `tools/supabase/bin/supabase-set`: URL, secret key, **publishable key** y, si se quiere
   hacer todo desde la terminal, `SUPABASE_DB_URL` (Connect > Session pooler).
2. `./scripts/go-live.sh` instala `supabase/setup.sql`, crea los 10 usuarios demo, corre las
   pruebas de acceso, recarga los datos de ejemplo y escribe `.env.local`.
   Sin `SUPABASE_DB_URL`: pegar `supabase/setup.sql` entero en SQL Editor > Run y después
   `./scripts/go-live.sh --skip-sql`.
3. `npm run build` y servir `dist/` (estático; Vercel o cualquier hosting). En el hosting van
   solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
   En Vercel las carga `./scripts/vercel-env.sh` (production, preview y development); sin
   ellas, un build hecho en Vercel sale sin Supabase y la app muestra "Falta configurar Supabase".
4. Recomendado en el dashboard: Authentication > Sign In / Providers > desactivar "Allow new
   users to sign up". Las cuentas las crea `npm run users`; un registro abierto no ve nada
   (no tiene perfil), pero no hace falta dejarlo abierto.

La secret key nunca va al navegador ni a `VITE_*`. `.demo-credentials` y `.env.local` están
fuera de git.

## Qué hay

| Ruta | Para quién | Qué hace |
|---|---|---|
| `src/views/Dashboard.jsx` | equipo | KPIs, piezas en riesgo, embudo, actividad, prospectos (ejemplo) |
| `src/views/Pipeline.jsx` | equipo | kanban por etapa, mover con ‹ › |
| `src/views/SponsorsList.jsx` | equipo | lista con filtros y búsqueda |
| `src/views/SponsorDetail.jsx` | equipo | ficha completa en 9 pestañas |
| `src/views/Approvals.jsx` | equipo | piezas esperando al cliente y cambios pedidos |
| `src/views/Portal.jsx` | patrocinador | su portal (el equipo lo ve en modo vista previa) |
| `supabase/migrations/` | | esquema, RLS, funciones, bucket y reglas de rutas |
| `supabase/setup.sql` | | todo lo anterior + datos de ejemplo, generado con `npm run seed:build` |

Lo que el prototipo no tenía y se agregó: login y roles reales, portal limitado a su propio
patrocinio, notas internas que el cliente no ve, pedir cambios con nota obligatoria, versiones
de propuesta, importar/exportar inscritos por CSV con cupos del paquete, subida y descarga de
archivos, alta de patrocinadores, configuración del evento y avance de etapa con registro de
actividad.

Fuera de alcance (se ve como "no conectado" en Configuración): HubSpot y envío de correos. Los
prospectos y el contacto de HubSpot son datos de ejemplo y lo dicen en pantalla.

## Desarrollo y pruebas locales

Sin Docker: Postgres 15, GoTrue, PostgREST y un Storage mínimo, ver `local/README.md`.

- `npm run lint`, `npm run build`
- `node scripts/rls-check.mjs`: permisos de cada rol contra la API (local o en vivo)
- `node local/e2e.cjs`: acciones de escritura en el navegador, equipo y patrocinador (solo local)
- `./local/reset.sh`: vuelve la base local a cero
