#!/usr/bin/env bash
# fix-must-change-password-default.sh - Fix must_change_password column default
#
# The original add-must-change-password migration added the column with DEFAULT 1,
# which set must_change_password=true for ALL existing admins. This caused existing
# admins to be forced through the password change workflow on their next login.
#
# This migration:
# 1. Changes the column default to 0 (false) for future rows
# 2. Resets must_change_password=false for existing admins who were incorrectly flagged
#
# Admins who were intentionally flagged via force-password-change are unaffected because
# force-password-change also sets sessions_revoked_at, so we only reset admins where
# sessions_revoked_at IS NULL (never had a forced change).
#
# This migration is idempotent and can be run multiple times safely.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source .env.local if it exists for database configuration
if [ -f "$PROJECT_ROOT/.env.local" ]; then
  set -a
  source "$PROJECT_ROOT/.env.local"
  set +a
fi

# Parse database connection string
if [ -z "${PORTAL_DATABASE_URL:-}" ]; then
  echo "Error: PORTAL_DATABASE_URL not set in .env.local"
  exit 1
fi

# Extract database name from connection string
db_name=$(echo "$PORTAL_DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')

# Build mysql connection arguments
MYSQL_ARGS=()

# Extract host from URL
if [[ "$PORTAL_DATABASE_URL" =~ mysql://([^:/@]+)(:([^@]+))?@([^:/]+) ]]; then
  db_user="${BASH_REMATCH[1]}"
  db_pass="${BASH_REMATCH[3]}"
  db_host="${BASH_REMATCH[4]}"
else
  echo "Error: Could not parse PORTAL_DATABASE_URL"
  exit 1
fi

# Try to detect if we should use socket or TCP
if [[ "$db_host" == "localhost" ]] || [[ "$db_host" == "127.0.0.1" ]]; then
  if [ -S "/tmp/mysql.sock" ]; then
    MYSQL_ARGS+=(--socket=/tmp/mysql.sock)
    MYSQL_ARGS+=(--user="${USER}")
  else
    MYSQL_ARGS+=(--host="$db_host")
    MYSQL_ARGS+=(--user="$db_user")
    if [ -n "$db_pass" ]; then
      MYSQL_ARGS+=(--password="$db_pass")
    fi
  fi
else
  MYSQL_ARGS+=(--host="$db_host")
  MYSQL_ARGS+=(--user="$db_user")
  if [ -n "$db_pass" ]; then
    MYSQL_ARGS+=(--password="$db_pass")
  fi
fi

echo "Fixing must_change_password column default in database: $db_name"
echo ""

# Execute the migration
if [ -n "${db_pass:-}" ]; then
  MYSQL_PWD="${db_pass}" mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
-- Step 1: Change column default from true to false for future rows
ALTER TABLE admins ALTER COLUMN must_change_password SET DEFAULT 0;

-- Step 2: Reset incorrectly flagged existing admins
-- Only reset admins where sessions_revoked_at IS NULL (never had a forced password change)
UPDATE admins SET must_change_password = 0
WHERE must_change_password = 1
  AND sessions_revoked_at IS NULL;
SQL
else
  mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
-- Step 1: Change column default from true to false for future rows
ALTER TABLE admins ALTER COLUMN must_change_password SET DEFAULT 0;

-- Step 2: Reset incorrectly flagged existing admins
-- Only reset admins where sessions_revoked_at IS NULL (never had a forced password change)
UPDATE admins SET must_change_password = 0
WHERE must_change_password = 1
  AND sessions_revoked_at IS NULL;
SQL
fi

if [ $? -eq 0 ]; then
  echo ""
  echo "Successfully fixed must_change_password column default"
  echo ""
  echo "Changes applied:"
  echo "  - Column default changed from true to false"
  echo "  - Existing admins (without forced password change) reset to must_change_password=false"
  exit 0
else
  echo ""
  echo "Error: Migration failed"
  exit 1
fi
