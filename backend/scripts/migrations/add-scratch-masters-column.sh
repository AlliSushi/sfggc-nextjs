#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

for f in .env.local .env; do
  if [[ -f "$PROJECT_ROOT/$f" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$PROJECT_ROOT/$f"
    set +a
    break
  fi
done

if [[ -z "${PORTAL_DATABASE_URL:-}" ]]; then
  echo "Error: PORTAL_DATABASE_URL not found in .env.local or .env"
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "Error: mysql client not found. Please install MariaDB client."
  exit 1
fi

db_name=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.pathname.replace('/', ''));")
db_user=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.username || process.env.USER);")
db_host=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.hostname || 'localhost');")
db_port=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.port || '3306');")
db_pass=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.password || '');")

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

echo "Adding scratch_masters column to people table in database: $db_name"

action_sql="SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '$db_name' AND TABLE_NAME = 'people' AND COLUMN_NAME = 'scratch_masters';"
if [[ -n "$db_pass" ]]; then
  COLUMN_EXISTS=$(MYSQL_PWD="$db_pass" mysql "${MYSQL_ARGS[@]}" -N -s "$db_name" -e "$action_sql")
else
  COLUMN_EXISTS=$(mysql "${MYSQL_ARGS[@]}" -N -s "$db_name" -e "$action_sql")
fi

if [[ "$COLUMN_EXISTS" -gt 0 ]]; then
  echo "✓ scratch_masters column already exists in people table"
  exit 0
fi

if [[ -n "$db_pass" ]]; then
  MYSQL_PWD="$db_pass" mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
ALTER TABLE people ADD COLUMN scratch_masters tinyint(1) not null default 0 AFTER division;
SQL
else
  mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
ALTER TABLE people ADD COLUMN scratch_masters tinyint(1) not null default 0 AFTER division;
SQL
fi

echo "✓ Successfully added scratch_masters column to people table"
