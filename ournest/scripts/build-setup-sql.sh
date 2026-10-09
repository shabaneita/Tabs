#!/usr/bin/env bash
# Regenerates supabase/setup.sql (all migrations in one file for the SQL Editor).
set -euo pipefail
cd "$(dirname "$0")/.."
{
  head -6 supabase/setup.sql 2>/dev/null || true
  for f in supabase/migrations/*.sql; do echo; echo "-- >>> $(basename "$f")"; cat "$f"; done
} > supabase/setup.sql.tmp && mv supabase/setup.sql.tmp supabase/setup.sql
echo "✓ supabase/setup.sql"
