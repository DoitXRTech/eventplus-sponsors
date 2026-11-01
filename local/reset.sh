#!/bin/sh
# Re-crea sponsors_local desde cero (esquema, seed y usuarios demo). GoTrue y PostgREST
# pueden quedar corriendo: se reconectan solos.
set -e
cd "$(dirname "$0")/.."
dropdb -h /tmp --if-exists --force sponsors_local
createdb -h /tmp sponsors_local
psql -h /tmp -d sponsors_local -q -f local/roles.sql >/dev/null 2>&1 || true
./local/gotrue.sh migrate >/dev/null
psql -h /tmp -d sponsors_local -q -v ON_ERROR_STOP=1 -f local/storage_shim.sql
for f in supabase/migrations/*.sql supabase/seed.sql; do psql -h /tmp -d sponsors_local -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done
psql -h /tmp -d sponsors_local -qc "notify pgrst, 'reload schema'"
# El primer pedido a GoTrue tras el drop puede caer en una conexion muerta del pool: un reintento.
users() { SUPABASE_URL=http://localhost:5173 SUPABASE_SERVICE_ROLE_KEY=$(node local/keys.mjs service) npm run -s users; }
users || { sleep 2; users; }
n=$(psql -h /tmp -d sponsors_local -Atc "select count(*) from auth.users")
[ "$n" -ge 10 ] || { echo "reset incompleto: $n usuarios en auth.users" >&2; exit 1; }
