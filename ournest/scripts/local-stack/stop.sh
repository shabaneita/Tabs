#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STACK_DIR="${STACK_DIR:-$ROOT/.local-stack}"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
for name in gateway postgrest gotrue; do
  pidfile="$STACK_DIR/run/$name.pid"
  [ -f "$pidfile" ] && kill "$(cat "$pidfile")" 2>/dev/null; rm -f "$pidfile"
done
as_pg() { if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
as_pg "$PG_BIN/pg_ctl" -D "$STACK_DIR/pgdata" -m fast stop >/dev/null 2>&1 || true
if [ "${1:-}" = "--reset" ]; then rm -rf "$STACK_DIR/pgdata"; echo "database wiped"; fi
echo "✓ local stack stopped"
