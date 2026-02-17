#!/usr/bin/env bash
# Delete an admin (and matching participant) by email. Use for local dev/testing only.
set -euo pipefail

EMAIL="${1:-}"
if [[ -z "${EMAIL}" ]]; then
  echo "Usage: $0 <admin-email>"
  echo "Example: $0 jfu@jfunson.com"
  exit 1
fi

# Load .env.local from repo root when PORTAL_DATABASE_URL not set
if [[ -z "${PORTAL_DATABASE_URL:-}" ]]; then
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
fi

if [[ -z "${PORTAL_DATABASE_URL:-}" ]]; then
  echo "Set PORTAL_DATABASE_URL (or add it to .env.local)."
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

run_mysql() {
  if [[ -n "${db_pass}" ]]; then
    MYSQL_PWD="${db_pass}" mysql "${MYSQL_ARGS[@]}" "${db_name}" "$@"
  else
    mysql "${MYSQL_ARGS[@]}" "${db_name}" "$@"
  fi
}

# Delete participant row with this email (so create-super-admin can re-create it)
run_mysql -e "delete from people where email = '${EMAIL}';"
# Delete admin row
run_mysql -e "delete from admins where email = '${EMAIL}';"

echo "Deleted admin and any participant row for: ${EMAIL}"
echo "Done. You can run create-super-admin.sh again for ${EMAIL}."
