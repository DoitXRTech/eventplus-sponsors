#!/bin/bash
# Levanta GoTrue (Auth de Supabase) local en :9999 contra sponsors_local.
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/local.env"
export GOTRUE_DB_DRIVER=postgres
export DATABASE_URL="postgres://supabase_auth_admin:local-auth-admin@localhost:5432/sponsors_local?sslmode=disable"
export GOTRUE_DB_MIGRATIONS_PATH="$HOME/Projects/github/third-party/supabase-auth/migrations"
export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
export GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
export API_EXTERNAL_URL=http://localhost:9999 GOTRUE_SITE_URL=http://localhost:5173
export GOTRUE_API_HOST=localhost PORT=9999 GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true
export GOTRUE_DISABLE_SIGNUP=false GOTRUE_LOG_LEVEL=warn
exec "$DIR/gotrue-bin" "$@"
