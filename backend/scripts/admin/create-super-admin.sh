#!/usr/bin/env bash
set -euo pipefail

CREATE_PARTICIPANT=false
PARTICIPANT_ONLY=false
for arg in "$@"; do
  if [[ "$arg" == "--participant" ]]; then
    CREATE_PARTICIPANT=true
  fi
  if [[ "$arg" == "--participant-only" ]]; then
    CREATE_PARTICIPANT=true
    PARTICIPANT_ONLY=true
  fi
done

if [[ -z "${ADMIN_EMAIL:-}" ]]; then
  echo "Set ADMIN_EMAIL before running this script."
  exit 1
fi

if [[ -z "${ADMIN_NAME:-}" ]]; then
  ADMIN_NAME="${ADMIN_EMAIL%@*}"
fi

if [[ "${SKIP_DB:-false}" == "true" ]]; then
  echo "Skipping database operations (SKIP_DB=true)."
  exit 0
fi

if [[ "${PARTICIPANT_ONLY}" != "true" ]]; then
  if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
    echo "Set ADMIN_PASSWORD before running this script."
    exit 1
  fi
fi

# Load .env.local from repo root only to set PORTAL_DATABASE_URL when not already in env.
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
  echo "Set PORTAL_DATABASE_URL before running this script (or add it to .env.local)."
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "mysql not found. Install MariaDB client first."
  exit 1
fi

ADMIN_ROLE="${ADMIN_ROLE:-super-admin}"
ADMIN_PID="${ADMIN_PID:-DEVADMIN}"

first_name="${ADMIN_NAME%% *}"
last_name="${ADMIN_NAME#* }"
if [[ "${last_name}" == "${ADMIN_NAME}" ]]; then
  last_name="Admin"
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

password_hash=""
if [[ "${PARTICIPANT_ONLY}" != "true" ]]; then
  password_hash=$(node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10));")
fi

if [[ "${PARTICIPANT_ONLY}" != "true" ]]; then
  echo "Creating admin in MariaDB..."
  admin_id=$(node -e "const { randomUUID } = require('crypto'); console.log(randomUUID());")
  if [[ -n "${db_pass}" ]]; then
    MYSQL_PWD="${db_pass}" mysql "${MYSQL_ARGS[@]}" "${db_name}" <<SQL
insert into admins (id, email, name, role, password_hash)
values ('${admin_id}', '${ADMIN_EMAIL}', '${ADMIN_NAME}', '${ADMIN_ROLE}', '${password_hash}')
on duplicate key update
  name = values(name),
  role = values(role),
  password_hash = values(password_hash);
SQL
  else
    mysql "${MYSQL_ARGS[@]}" "${db_name}" <<SQL
insert into admins (id, email, name, role, password_hash)
values ('${admin_id}', '${ADMIN_EMAIL}', '${ADMIN_NAME}', '${ADMIN_ROLE}', '${password_hash}')
on duplicate key update
  name = values(name),
  role = values(role),
  password_hash = values(password_hash);
SQL
  fi
  echo "Creating matching participant in people table..."
  if [[ -n "${db_pass}" ]]; then
    MYSQL_PWD="${db_pass}" mysql "${MYSQL_ARGS[@]}" "${db_name}" <<SQL
insert into people (pid, first_name, last_name, email)
values ('${ADMIN_PID}', '${first_name}', '${last_name}', '${ADMIN_EMAIL}')
on duplicate key update
  first_name = values(first_name),
  last_name = values(last_name),
  email = values(email),
  updated_at = now();
SQL
  else
    mysql "${MYSQL_ARGS[@]}" "${db_name}" <<SQL
insert into people (pid, first_name, last_name, email)
values ('${ADMIN_PID}', '${first_name}', '${last_name}', '${ADMIN_EMAIL}')
on duplicate key update
  first_name = values(first_name),
  last_name = values(last_name),
  email = values(email),
  updated_at = now();
SQL
  fi
  echo "Participant PID: ${ADMIN_PID}"
elif [[ "${CREATE_PARTICIPANT}" == "true" ]]; then
  echo "Creating participant in MariaDB..."
  if [[ -n "${db_pass}" ]]; then
    MYSQL_PWD="${db_pass}" mysql "${MYSQL_ARGS[@]}" "${db_name}" <<SQL
insert into people (pid, first_name, last_name, email)
values ('${ADMIN_PID}', '${first_name}', '${last_name}', '${ADMIN_EMAIL}')
on duplicate key update
  first_name = values(first_name),
  last_name = values(last_name),
  email = values(email),
  updated_at = now();
SQL
  else
    mysql "${MYSQL_ARGS[@]}" "${db_name}" <<SQL
insert into people (pid, first_name, last_name, email)
values ('${ADMIN_PID}', '${first_name}', '${last_name}', '${ADMIN_EMAIL}')
on duplicate key update
  first_name = values(first_name),
  last_name = values(last_name),
  email = values(email),
  updated_at = now();
SQL
  fi
  echo "Participant PID: ${ADMIN_PID}"
fi

echo "Done."
