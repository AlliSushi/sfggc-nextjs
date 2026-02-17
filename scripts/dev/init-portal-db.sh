#!/usr/bin/env bash
set -euo pipefail

# Load .env.local from project root so PORTAL_DATABASE_URL is set when running the script directly.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
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
  echo "Set PORTAL_DATABASE_URL before running this script (or add it to .env.local)."
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "mysql not found. Install MariaDB client first."
  exit 1
fi

db_name=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.pathname.replace('/', ''));")
db_user=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.username || process.env.USER);")
db_host=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.hostname || 'localhost');")
db_port=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.port || '3306');")
db_pass=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.password || '');")

if [[ -z "${db_name}" ]]; then
  echo "Unable to determine database name from PORTAL_DATABASE_URL."
  exit 1
fi

# Use Unix socket for localhost (avoids ERROR 1698 with TCP).
# Homebrew MariaDB: "root" is often socket-only for OS user root; use current OS user instead.
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
    # Socket: use current OS user so socket auth works (root often only works as uid 0).
    MYSQL_CLI_USER="${USER:-$(whoami)}"
    MYSQL_ARGS=(--socket "${MYSQL_SOCKET}" -u "${MYSQL_CLI_USER}")
  else
    MYSQL_ARGS=(--protocol=tcp -h "${db_host}" -P "${db_port}" -u "${db_user}")
  fi
else
  MYSQL_ARGS=(--protocol=tcp -h "${db_host}" -P "${db_port}" -u "${db_user}")
fi

echo "Ensuring database exists: ${db_name}"
if [[ -n "${db_pass}" ]]; then
  MYSQL_PWD="${db_pass}" mysql "${MYSQL_ARGS[@]}" mysql -e "create database if not exists \`${db_name}\`;" 2>/dev/null || echo "(Skipping database creation - may not have privileges, assuming database exists)"
else
  mysql "${MYSQL_ARGS[@]}" mysql -e "create database if not exists \`${db_name}\`;" 2>/dev/null || echo "(Skipping database creation - may not have privileges, assuming database exists)"
fi

echo "Initializing portal database schema..."
if [[ -n "${db_pass}" ]]; then
  MYSQL_PWD="${db_pass}" mysql "${MYSQL_ARGS[@]}" "${db_name}" < "portal_docs/sql/portal_schema.sql"
else
  mysql "${MYSQL_ARGS[@]}" "${db_name}" < "portal_docs/sql/portal_schema.sql"
fi

echo "Running portal migrations..."
bash "$PROJECT_ROOT/scripts/dev/run-portal-migrations.sh"

echo "Done."
