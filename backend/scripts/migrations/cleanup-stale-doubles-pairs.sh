#!/bin/bash
set -euo pipefail

# Migration: Cleanup stale doubles_pairs rows
# Purpose: Remove doubles_pairs rows where dp.did does not match the participant's
#          current did in the people table. These stale rows accumulate when participants
#          change doubles partners via XML re-imports without cleanup.
# Date: 2026-02-13
#
# This migration is inherently idempotent: DELETE of non-existent rows is a no-op.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load .env.local
if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
  set -a
  source "$PROJECT_ROOT/.env.local"
  set +a
elif [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
else
  echo "ERROR: .env.local not found at $PROJECT_ROOT/.env.local"
  exit 1
fi

if [[ -z "${PORTAL_DATABASE_URL:-}" ]]; then
  echo "ERROR: PORTAL_DATABASE_URL not set in .env.local"
  exit 1
fi

# Parse database connection
db_name=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.pathname.replace('/', ''));")
db_user=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.username || process.env.USER);")
db_host=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.hostname || 'localhost');")
db_port=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.port || '3306');")
db_pass=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.password || '');")

# Use Unix socket for localhost (avoids ERROR 1698 with root/socket auth on Homebrew MariaDB)
if [[ "${db_host}" == "localhost" || "${db_host}" == "127.0.0.1" ]]; then
  if [[ -n "${MYSQL_UNIX_SOCKET:-}" && -S "${MYSQL_UNIX_SOCKET}" ]]; then
    MYSQL_SOCKET="${MYSQL_UNIX_SOCKET}"
  else
    for sock in /tmp/mysql.sock /opt/homebrew/var/mysql/mysql.sock /usr/local/var/mysql/mysql.sock; do
      if [[ -S "$sock" ]]; then
        MYSQL_SOCKET="$sock"
        break
      fi
    done
  fi
  if [[ -n "${MYSQL_SOCKET:-}" ]]; then
    MYSQL_CLI_USER="${USER:-$(whoami)}"
    MYSQL_ARGS=(--socket "${MYSQL_SOCKET}" -u "${MYSQL_CLI_USER}")
  else
    MYSQL_ARGS=(--protocol=tcp -h "${db_host}" -P "${db_port}" -u "${db_user}")
  fi
else
  MYSQL_ARGS=(--protocol=tcp -h "${db_host}" -P "${db_port}" -u "${db_user}")
fi

echo "Applying migration: cleanup stale doubles_pairs rows..."

# Step 1: Count stale rows before cleanup (for reporting)
if [[ -n "$db_pass" ]]; then
  STALE_COUNT=$(MYSQL_PWD="$db_pass" mysql "${MYSQL_ARGS[@]}" -N -s "$db_name" <<SQL
SELECT COUNT(*) FROM doubles_pairs dp
JOIN people p ON dp.pid = p.pid
WHERE dp.did <> p.did;
SQL
)
else
  STALE_COUNT=$(mysql "${MYSQL_ARGS[@]}" -N -s "$db_name" <<SQL
SELECT COUNT(*) FROM doubles_pairs dp
JOIN people p ON dp.pid = p.pid
WHERE dp.did <> p.did;
SQL
)
fi

if [[ "$STALE_COUNT" -eq 0 ]]; then
  echo "✓ No stale doubles_pairs rows found — nothing to clean up"
else
  echo "  Found $STALE_COUNT stale doubles_pairs row(s) to remove"

  # Step 2: DELETE stale doubles_pairs rows where did does not match participant's current did
  if [[ -n "$db_pass" ]]; then
    MYSQL_PWD="$db_pass" mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
-- Remove stale doubles_pairs rows (dp.did does not match participant's current p.did)
DELETE dp FROM doubles_pairs dp
JOIN people p ON dp.pid = p.pid
WHERE dp.did <> p.did;
SQL
  else
    mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
-- Remove stale doubles_pairs rows (dp.did does not match participant's current p.did)
DELETE dp FROM doubles_pairs dp
JOIN people p ON dp.pid = p.pid
WHERE dp.did <> p.did;
SQL
  fi

  echo "  Removed $STALE_COUNT stale doubles_pairs row(s)"
fi

# Step 3: Clear partner_pid references that point to participants no longer in doubles_pairs
if [[ -n "$db_pass" ]]; then
  DANGLING_COUNT=$(MYSQL_PWD="$db_pass" mysql "${MYSQL_ARGS[@]}" -N -s "$db_name" <<SQL
SELECT COUNT(*) FROM doubles_pairs dp
WHERE dp.partner_pid IS NOT NULL
  AND dp.partner_pid NOT IN (SELECT pid FROM doubles_pairs);
SQL
)
else
  DANGLING_COUNT=$(mysql "${MYSQL_ARGS[@]}" -N -s "$db_name" <<SQL
SELECT COUNT(*) FROM doubles_pairs dp
WHERE dp.partner_pid IS NOT NULL
  AND dp.partner_pid NOT IN (SELECT pid FROM doubles_pairs);
SQL
)
fi

if [[ "$DANGLING_COUNT" -gt 0 ]]; then
  echo "  Found $DANGLING_COUNT dangling partner_pid reference(s) to clean up"

  if [[ -n "$db_pass" ]]; then
    MYSQL_PWD="$db_pass" mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
-- Clear partner_pid references to participants no longer in doubles_pairs
UPDATE doubles_pairs dp
SET dp.partner_pid = NULL
WHERE dp.partner_pid IS NOT NULL
  AND dp.partner_pid NOT IN (SELECT sub.pid FROM (SELECT pid FROM doubles_pairs) sub);
SQL
  else
    mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
-- Clear partner_pid references to participants no longer in doubles_pairs
UPDATE doubles_pairs dp
SET dp.partner_pid = NULL
WHERE dp.partner_pid IS NOT NULL
  AND dp.partner_pid NOT IN (SELECT sub.pid FROM (SELECT pid FROM doubles_pairs) sub);
SQL
  fi

  echo "  Cleared $DANGLING_COUNT dangling partner_pid reference(s)"
else
  echo "  No dangling partner_pid references found"
fi

echo "✓ Migration completed: Cleaned up stale doubles_pairs rows"
