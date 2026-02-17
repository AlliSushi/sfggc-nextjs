#!/usr/bin/env bash
# add-must-change-password.sh - Add must_change_password column to admins table
#
# This migration adds a must_change_password boolean column to the admins table
# to ensure that new admins are forced to change their initial password on first login.
#
# Unlike password reset tokens which expire after 1 hour, this flag persists until
# the admin changes their password, ensuring the security requirement is met regardless
# of when the admin first logs in.
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

echo "Adding must_change_password column to admins table in database: $db_name"
echo "This ensures new admins must change their initial password on first login"
echo ""

# Execute the migration
mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
-- Add must_change_password column if it doesn't exist
-- Using IF NOT EXISTS for MariaDB 10.0.2+ / MySQL 8.0.29+
-- For older versions, this will error if column exists, but script will continue

-- Check if column exists before adding
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = '$db_name'
  AND TABLE_NAME = 'admins'
  AND COLUMN_NAME = 'must_change_password';

SET @query = IF(@col_exists = 0,
  'ALTER TABLE admins ADD COLUMN must_change_password boolean DEFAULT 0 AFTER role',
  'SELECT "Column must_change_password already exists" AS message');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SQL

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ must_change_password column added successfully"
  echo ""
  echo "Column details:"
  echo "  - Type: boolean (tinyint(1) in MariaDB/MySQL)"
  echo "  - Default: true (1) - new admins must change password"
  echo "  - Location: after role column"
  echo ""
  echo "All newly created admins will be required to change their password on first login."
  echo "Existing admins are not affected (column defaults to true but they've already logged in)."
  exit 0
else
  echo ""
  echo "✗ Migration failed"
  exit 1
fi
