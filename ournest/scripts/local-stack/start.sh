#!/usr/bin/env bash
# Starts a Docker-free, Supabase-compatible stack for local development
# and automated tests: PostgreSQL + GoTrue (Supabase Auth) + PostgREST
# behind a small gateway on http://127.0.0.1:54321.
#
# Storage is NOT emulated (receipt upload needs a real Supabase project
# or `supabase start`). Prefer the official Supabase CLI if Docker is
# available; this script exists for CI/containers without Docker.
#
# Env overrides: STACK_DIR, PG_BIN, PG_PORT, GOTRUE_VERSION, POSTGREST_VERSION
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STACK_DIR="${STACK_DIR:-$ROOT/.local-stack}"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PG_PORT="${PG_PORT:-54329}"
GOTRUE_PORT="${GOTRUE_PORT:-54331}"
POSTGREST_PORT="${POSTGREST_PORT:-54332}"
GATEWAY_PORT="${GATEWAY_PORT:-54321}"
GOTRUE_VERSION="${GOTRUE_VERSION:-v2.180.0}"
POSTGREST_VERSION="${POSTGREST_VERSION:-v12.2.3}"
JWT_SECRET="${JWT_SECRET:-local-dev-jwt-secret-with-at-least-32-characters}"
SITE_URL="${SITE_URL:-http://localhost:3000}"

mkdir -p "$STACK_DIR/bin" "$STACK_DIR/logs" "$STACK_DIR/run"
chmod 755 "$STACK_DIR" "$STACK_DIR/run" "$STACK_DIR/logs"

# --- binaries -----------------------------------------------------------
if [ ! -x "$STACK_DIR/bin/auth" ]; then
  echo "↓ GoTrue $GOTRUE_VERSION"
  curl -fsSL "https://github.com/supabase/auth/releases/download/$GOTRUE_VERSION/auth-$GOTRUE_VERSION-x86.tar.gz" \
    | tar xz -C "$STACK_DIR/bin"
fi
if [ ! -x "$STACK_DIR/bin/postgrest" ]; then
  echo "↓ PostgREST $POSTGREST_VERSION"
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x64.tar.xz" \
    | tar xJ -C "$STACK_DIR/bin"
fi

# --- postgres (must not run as root) -------------------------------------
as_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}
PGDATA="$STACK_DIR/pgdata"
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  mkdir -p "$PGDATA"
  [ "$(id -u)" = "0" ] && chown postgres "$PGDATA" "$STACK_DIR/run" "$STACK_DIR/logs"
  as_pg "$PG_BIN/initdb" -D "$PGDATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
fi
if ! as_pg "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  as_pg "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$STACK_DIR/logs/postgres.log" \
    -o "-p $PG_PORT -k $STACK_DIR/run -c listen_addresses=127.0.0.1 -c timezone=UTC" -w start >/dev/null
fi
PSQL=(psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$ROOT/scripts/local-stack/shim.sql"

# --- GoTrue migrations ---------------------------------------------------
export GOTRUE_DB_DRIVER=postgres
export DATABASE_URL="postgres://supabase_auth_admin:auth-admin-local@127.0.0.1:$PG_PORT/postgres?search_path=auth&sslmode=disable"
export GOTRUE_DB_DATABASE_URL="$DATABASE_URL"
export GOTRUE_DB_MIGRATIONS_PATH="$STACK_DIR/bin/migrations"
export GOTRUE_JWT_SECRET="$JWT_SECRET"
export GOTRUE_JWT_EXP=3600
export GOTRUE_JWT_AUD=authenticated
export GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
export GOTRUE_JWT_ADMIN_ROLES=service_role
export GOTRUE_SITE_URL="$SITE_URL"
export GOTRUE_URI_ALLOW_LIST="$SITE_URL/**"
export API_EXTERNAL_URL="http://127.0.0.1:$GATEWAY_PORT/auth/v1"
export GOTRUE_API_HOST=127.0.0.1
export PORT="$GOTRUE_PORT"
export GOTRUE_EXTERNAL_EMAIL_ENABLED=true
export GOTRUE_MAILER_AUTOCONFIRM=true
export GOTRUE_DISABLE_SIGNUP=false
export GOTRUE_RATE_LIMIT_EMAIL_SENT=1000
export GOTRUE_RATE_LIMIT_TOKEN_REFRESH=10000
export GOTRUE_RATE_LIMIT_VERIFY=10000
export GOTRUE_RATE_LIMIT_SIGN_UP_SIGN_IN=10000
export GOTRUE_LOG_LEVEL=warn
(cd "$STACK_DIR/bin" && ./auth migrate >"$STACK_DIR/logs/auth-migrate.log" 2>&1) \
  || { cat "$STACK_DIR/logs/auth-migrate.log"; exit 1; }

# --- app migrations (tracked) ------------------------------------------
for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  applied="$("${PSQL[@]}" -tAc "select 1 from public.local_schema_migrations where name = '$name'")"
  if [ -z "$applied" ]; then
    echo "→ migrate $name"
    "${PSQL[@]}" -1 -f "$f"
    "${PSQL[@]}" -c "insert into public.local_schema_migrations (name) values ('$name')"
  fi
done
"${PSQL[@]}" -c "notify pgrst, 'reload schema'" >/dev/null

# --- services --------------------------------------------------------------
start_bg() { # name, command...
  local name="$1"; shift
  local pidfile="$STACK_DIR/run/$name.pid"
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then return; fi
  nohup "$@" >"$STACK_DIR/logs/$name.log" 2>&1 &
  echo $! >"$pidfile"
}

start_bg gotrue bash -c "cd '$STACK_DIR/bin' && exec ./auth serve"

cat >"$STACK_DIR/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:authenticator-local@127.0.0.1:$PG_PORT/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = $POSTGREST_PORT
db-max-rows = 1000
CONF
start_bg postgrest "$STACK_DIR/bin/postgrest" "$STACK_DIR/postgrest.conf"

GATEWAY_PORT=$GATEWAY_PORT GOTRUE_PORT=$GOTRUE_PORT POSTGREST_PORT=$POSTGREST_PORT \
  start_bg gateway node "$ROOT/scripts/local-stack/gateway.mjs"

# --- wait & print env -----------------------------------------------------
for i in $(seq 1 60); do
  if curl -fs "http://127.0.0.1:$GATEWAY_PORT/auth/v1/health" >/dev/null 2>&1 \
    && curl -fs "http://127.0.0.1:$GATEWAY_PORT/rest/v1/" -o /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

eval "$(node "$ROOT/scripts/local-stack/keys.mjs" "$JWT_SECRET")"
cat >"$STACK_DIR/env" <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$GATEWAY_PORT
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:$PG_PORT/postgres
ENV
echo "✓ local stack ready — env written to $STACK_DIR/env"
