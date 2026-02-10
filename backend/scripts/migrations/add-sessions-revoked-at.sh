#!/usr/bin/env bash
# add-sessions-revoked-at.sh - Add sessions_revoked_at column to admins table
#
# This migration adds a sessions_revoked_at timestamp column to track when
# all sessions for an admin should be invalidated. This is used for security
# breach scenarios where we need to immediately revoke all active sessions
# and force a password change.
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
  # Try Unix socket first (faster for local connections)
  if [ -S "/tmp/mysql.sock" ]; then
    MYSQL_ARGS+=(--socket=/tmp/mysql.sock)
    # Use current user for socket connection (no password needed)
    MYSQL_ARGS+=(--user="${USER}")
  else
    # Fallback to TCP if socket not available
    MYSQL_ARGS+=(--host="$db_host")
    MYSQL_ARGS+=(--user="$db_user")
    if [ -n "$db_pass" ]; then
      MYSQL_ARGS+=(--password="$db_pass")
    fi
  fi
else
  # Remote connection - use credentials
  MYSQL_ARGS+=(--host="$db_host")
  MYSQL_ARGS+=(--user="$db_user")
  if [ -n "$db_pass" ]; then
    MYSQL_ARGS+=(--password="$db_pass")
  fi
fi

echo "Adding sessions_revoked_at column to admins table in database: $db_name"
echo "This enables immediate session revocation for security breach scenarios"
echo ""

# Execute the migration
mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
-- Add sessions_revoked_at column if it doesn't exist
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = '$db_name'
  AND TABLE_NAME = 'admins'
  AND COLUMN_NAME = 'sessions_revoked_at';

SET @query = IF(@col_exists = 0,
  'ALTER TABLE admins ADD COLUMN sessions_revoked_at TIMESTAMP NULL AFTER must_change_password',
  'SELECT "Column sessions_revoked_at already exists" AS message');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SQL

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ sessions_revoked_at column added successfully"
  echo ""
  echo "Column details:"
  echo "  - Type: TIMESTAMP NULL"
  echo "  - Default: NULL (only set when forcing session revocation)"
  echo "  - Location: after must_change_password column"
  echo ""
  echo "Usage: Set this timestamp when forcing password change to invalidate all sessions"
  echo "created before this time. Auth guards will check this timestamp on every request."
  exit 0
else
  echo ""
  echo "✗ Migration failed"
  exit 1
fi
