#!/bin/bash
# Deja el demo andando contra el proyecto Supabase real, en un solo paso:
#   1. instala esquema, reglas, bucket y datos de ejemplo (supabase/setup.sql)
#   2. crea los 10 usuarios demo (.demo-credentials, fuera de git)
#   3. corre las pruebas de acceso (scripts/rls-check.mjs) con la llave publica
#   4. recarga los datos de ejemplo (las pruebas mueven etapas y aprueban piezas)
#   5. escribe .env.local para que `npm run dev` / `npm run build` apunten al proyecto
#
# Lee ~/jarvis-workspace/tools/supabase/.supabase.env (o el entorno). Necesita:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY),
#   SUPABASE_PUBLISHABLE_KEY (o SUPABASE_ANON_KEY) y SUPABASE_DB_URL (Connect > Session pooler).
# Sin SUPABASE_DB_URL: pegar supabase/setup.sql en el SQL Editor y correr con --skip-sql.
# Nunca imprime llaves ni la clave de la base.
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="${SUPABASE_ENV_FILE:-$HOME/jarvis-workspace/tools/supabase/.supabase.env}"
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }
SKIP_SQL=0; [ "${1:-}" = "--skip-sql" ] && SKIP_SQL=1

SECRET="${SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_SECRET_KEY:-}}"
PUBLIC_KEY="${SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}"
missing=()
[ -n "${SUPABASE_URL:-}" ] || missing+=(SUPABASE_URL)
[ -n "$SECRET" ] || missing+=(SUPABASE_SERVICE_ROLE_KEY)
[ -n "$PUBLIC_KEY" ] || missing+=(SUPABASE_PUBLISHABLE_KEY)
[ $SKIP_SQL = 1 ] || [ -n "${SUPABASE_DB_URL:-}" ] || missing+=(SUPABASE_DB_URL)
if [ ${#missing[@]} -gt 0 ]; then echo "Faltan: ${missing[*]} (en $ENV_FILE o en el entorno)"; exit 3; fi
case "$PUBLIC_KEY" in sb_secret_*) echo "La llave publica es una sb_secret_: no va al navegador. Usar la publishable."; exit 3;; esac

run_sql() { psql "$SUPABASE_DB_URL" -q -v ON_ERROR_STOP=1 -f "$1" >/dev/null; }

if [ $SKIP_SQL = 0 ]; then echo "1/5 setup.sql"; run_sql supabase/setup.sql; else echo "1/5 setup.sql: salteado (--skip-sql)"; fi
auth=(-H "apikey: $SECRET"); [ "$(tr -cd . <<<"$SECRET" | wc -c)" -eq 2 ] && auth+=(-H "Authorization: Bearer $SECRET")
code=$(curl -s -o /dev/null -w '%{http_code}' "$SUPABASE_URL/rest/v1/sponsors?select=id&limit=1" "${auth[@]}")
[ "$code" = 200 ] || { echo "La API no ve public.sponsors (HTTP $code): el esquema no esta instalado."; exit 1; }

echo "2/5 usuarios demo"
SUPABASE_SERVICE_ROLE_KEY="$SECRET" npm run -s users

echo "3/5 pruebas de acceso"
SUPABASE_ANON_KEY="$PUBLIC_KEY" node scripts/rls-check.mjs

echo "4/5 recargar datos de ejemplo"
if [ $SKIP_SQL = 0 ]; then run_sql supabase/seed.sql; else echo "   pegar supabase/seed.sql en el SQL Editor (las pruebas dejaron cambios)"; fi

echo "5/5 .env.local"
umask 177
printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$SUPABASE_URL" "$PUBLIC_KEY" > .env.local
echo "Listo. npm run dev (o npm run build) usa el proyecto real. Usuarios y clave en .demo-credentials."
