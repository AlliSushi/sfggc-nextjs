#!/bin/bash
set -euo pipefail

# Migration: Add unique constraint on scores(pid, event_type)
# Purpose: Ensure ON DUPLICATE KEY UPDATE works correctly in XML imports
# Date: 2026-02-09

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load .env.local
if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
  set -a
  source "$PROJECT_ROOT/.env.local"
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

# Check if unique constraint already exists (idempotent check)
if [[ -n "$db_pass" ]]; then
  EXISTS=$(MYSQL_PWD="$db_pass" mysql "${MYSQL_ARGS[@]}" -N -s "$db_name" <<SQL
SELECT COUNT(*) FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = '$db_name'
  AND TABLE_NAME = 'scores'
  AND INDEX_NAME = 'pid_event_unique';
SQL
)
else
  EXISTS=$(mysql "${MYSQL_ARGS[@]}" -N -s "$db_name" <<SQL
SELECT COUNT(*) FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = '$db_name'
  AND TABLE_NAME = 'scores'
  AND INDEX_NAME = 'pid_event_unique';
SQL
)
fi

if [[ "$EXISTS" -gt 0 ]]; then
  echo "✓ Unique constraint 'pid_event_unique' already exists on scores table"
  exit 0
fi

echo "Applying migration: add unique constraint on scores(pid, event_type)..."

# Apply the migration
if [[ -n "$db_pass" ]]; then
  MYSQL_PWD="$db_pass" mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
-- Step 1: Remove duplicate score records, keeping only the most recent
-- This handles cases where multiple imports created duplicate records
DELETE s1 FROM scores s1
INNER JOIN scores s2 ON s1.pid = s2.pid AND s1.event_type = s2.event_type
WHERE s1.updated_at < s2.updated_at
   OR (s1.updated_at = s2.updated_at AND s1.id > s2.id);

-- Step 2: Add unique constraint to prevent future duplicates
-- This makes ON DUPLICATE KEY UPDATE work correctly in imports
ALTER TABLE scores
ADD UNIQUE INDEX pid_event_unique (pid, event_type);
SQL
else
  mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
-- Step 1: Remove duplicate score records, keeping only the most recent
-- This handles cases where multiple imports created duplicate records
DELETE s1 FROM scores s1
INNER JOIN scores s2 ON s1.pid = s2.pid AND s1.event_type = s2.event_type
WHERE s1.updated_at < s2.updated_at
   OR (s1.updated_at = s2.updated_at AND s1.id > s2.id);

-- Step 2: Add unique constraint to prevent future duplicates
-- This makes ON DUPLICATE KEY UPDATE work correctly in imports
ALTER TABLE scores
ADD UNIQUE INDEX pid_event_unique (pid, event_type);
SQL
fi

echo "✓ Migration completed successfully"
echo "  - Removed duplicate score records"
echo "  - Added unique constraint on scores(pid, event_type)"
