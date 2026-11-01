# Stack local (solo para desarrollo y pruebas)

Imita lo que Supabase sirve, sin Docker: Postgres 15 (Homebrew), GoTrue (Auth, compilado de
`supabase/auth`) en :9999 y PostgREST en :3011. Vite (:5173) hace de gateway con el proxy de
`vite.config.js`. Storage no existe en local: sus politicas se prueban con `storage_shim.sql`.

```bash
createdb -h /tmp sponsors_local
psql -h /tmp -d sponsors_local -f local/roles.sql
./local/gotrue.sh migrate
psql -h /tmp -d sponsors_local -f local/storage_shim.sql
for f in supabase/migrations/*.sql supabase/seed.sql; do psql -h /tmp -d sponsors_local -v ON_ERROR_STOP=1 -f $f; done
./local/gotrue.sh serve &  ./local/postgrest.sh &
VITE_SUPABASE_URL=http://localhost:5173 VITE_SUPABASE_PUBLISHABLE_KEY=$(node local/keys.mjs anon) npm run dev
SUPABASE_URL=http://localhost:5173 SUPABASE_SERVICE_ROLE_KEY=$(node local/keys.mjs service) npm run users
SUPABASE_URL=http://localhost:5173 SUPABASE_ANON_KEY=$(node local/keys.mjs anon) node scripts/rls-check.mjs
```

Antes: `cp local/local.env.example local/local.env` (JWT_SECRET de juguete, solo local, fuera de git). `gotrue-bin` no se versiona.
