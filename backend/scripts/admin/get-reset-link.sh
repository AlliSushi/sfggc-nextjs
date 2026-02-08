#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# get-reset-link.sh — Retrieve the latest password reset link for an admin.
#
# Usage:
#   bash backend/scripts/admin/get-reset-link.sh <email>
#
# Examples:
#   bash backend/scripts/admin/get-reset-link.sh jfu@jfunson.com
#   bash backend/scripts/admin/get-reset-link.sh admin@goldengateclassic.org
# ──────────────────────────────────────────────────────────────────────────────

EMAIL="${1:-}"
if [[ -z "${EMAIL}" ]]; then
  echo "Usage: bash backend/scripts/admin/get-reset-link.sh <email>"
  exit 1
fi

# Load .env.local from repo root to set PORTAL_DATABASE_URL and PORTAL_BASE_URL.
if [[ -z "${PORTAL_DATABASE_URL:-}" || -z "${PORTAL_BASE_URL:-}" ]]; then
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
  echo "Set PORTAL_DATABASE_URL before running this script (or add it to .env.local)."
  exit 1
fi

BASE_URL="${PORTAL_BASE_URL:-http://localhost:3000}"

if ! command -v mysql >/dev/null 2>&1; then
  echo "mysql client not found. Install MariaDB client first."
  exit 1
fi

db_name=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.pathname.replace('/', ''));")
db_user=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.username || process.env.USER);")
db_host=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.hostname || 'localhost');")
db_port=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.port || '3306');")
db_pass=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.password || '');")

# Use Unix socket for localhost (avoids ERROR 1698 with root/socket auth on Homebrew MariaDB).
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

run_query() {
  if [[ -n "${db_pass}" ]]; then
    MYSQL_PWD="${db_pass}" mysql "${MYSQL_ARGS[@]}" "${db_name}" --batch --skip-column-names -e "$1"
  else
    mysql "${MYSQL_ARGS[@]}" "${db_name}" --batch --skip-column-names -e "$1"
  fi
}

# Verify the admin account exists.
admin_exists=$(run_query "SELECT COUNT(*) FROM admins WHERE LOWER(email) = LOWER('${EMAIL}');")
if [[ "${admin_exists}" -eq 0 ]]; then
  echo "No admin account found for: ${EMAIL}"
  exit 1
fi

# Get the latest reset token for this admin.
result=$(run_query "
  SELECT r.token, r.created_at, r.expires_at, r.used_at
  FROM admin_password_resets r
  JOIN admins a ON a.id = r.admin_id
  WHERE LOWER(a.email) = LOWER('${EMAIL}')
  ORDER BY r.created_at DESC
  LIMIT 1;
")

if [[ -z "${result}" ]]; then
  echo "No reset tokens found for: ${EMAIL}"
  echo "Request one at: ${BASE_URL}/portal/admin/reset"
  exit 0
fi

token=$(echo "${result}" | cut -f1)
created_at=$(echo "${result}" | cut -f2)
expires_at=$(echo "${result}" | cut -f3)
used_at=$(echo "${result}" | cut -f4)

echo ""
echo "  Admin:      ${EMAIL}"
echo "  Created:    ${created_at}"
echo "  Expires:    ${expires_at}"

if [[ -n "${used_at}" && "${used_at}" != "NULL" ]]; then
  echo "  Status:     USED (at ${used_at})"
  echo ""
  echo "  This token has already been used. Request a new one at:"
  echo "  ${BASE_URL}/portal/admin/reset"
else
  now=$(date +%s)
  exp=$(node -e "console.log(Math.floor(new Date('${expires_at}').getTime() / 1000));")
  if [[ "${now}" -gt "${exp}" ]]; then
    echo "  Status:     EXPIRED"
    echo ""
    echo "  This token has expired. Request a new one at:"
    echo "  ${BASE_URL}/portal/admin/reset"
  else
    echo "  Status:     ACTIVE"
    echo ""
    echo "  Reset link:"
    echo "  ${BASE_URL}/portal/admin/reset?token=${token}"
  fi
fi
echo ""
