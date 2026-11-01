#!/bin/bash
# Levanta PostgREST local en :3011 (lo que Supabase sirve en /rest/v1).
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/local.env"
export PGRST_DB_URI="postgres://authenticator:local-authenticator@localhost:5432/sponsors_local"
export PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=3011 PGRST_SERVER_HOST=127.0.0.1
export PGRST_DB_CHANNEL_ENABLED=true
exec postgrest
