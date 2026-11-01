#!/bin/bash
# Carga en el proyecto de Vercel (production, preview, development) las dos variables que el
# build necesita, y escribe .env.local para los builds locales. Sin esto, un build hecho en
# Vercel sale sin Supabase y la app muestra "Falta configurar Supabase".
#
# Lee ~/jarvis-workspace/tools/supabase/.supabase.env (o el entorno): SUPABASE_URL y
# SUPABASE_PUBLISHABLE_KEY. La secret key nunca va al navegador ni a Vercel.
# Necesita VERCEL_CLI (default: ~/jarvis-workspace/tools/vercel/bin/vercel). No imprime llaves.
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="${SUPABASE_ENV_FILE:-$HOME/jarvis-workspace/tools/supabase/.supabase.env}"
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }
VERCEL="${VERCEL_CLI:-$HOME/jarvis-workspace/tools/vercel/bin/vercel}"
PUBLIC_KEY="${SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}"
[ -n "${SUPABASE_URL:-}" ] && [ -n "$PUBLIC_KEY" ] || { echo "Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY en $ENV_FILE"; exit 3; }
case "$PUBLIC_KEY" in sb_secret_*) echo "La llave publica es una sb_secret_: no va al navegador."; exit 3;; esac

put() { # nombre valor entorno: reemplaza si ya existe
  "$VERCEL" env rm "$1" "$3" --yes >/dev/null 2>&1 || true
  printf %s "$2" | "$VERCEL" env add "$1" "$3" >/dev/null 2>&1 || { echo "vercel env add $1 $3 fallo"; exit 1; }
  echo "ok $1 ($3)"
}
for target in production preview development; do
  put VITE_SUPABASE_URL "$SUPABASE_URL" "$target"
  put VITE_SUPABASE_PUBLISHABLE_KEY "$PUBLIC_KEY" "$target"
done

umask 177
printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$SUPABASE_URL" "$PUBLIC_KEY" > .env.local
echo "ok .env.local"
