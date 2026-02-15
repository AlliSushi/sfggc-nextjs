#!/usr/bin/env bash
set -euo pipefail

# Backfill division column on people table from scores.entering_avg.
# Division was added after the initial XML import, so existing participants
# have division=NULL even though their entering average is on file.
# This migration derives division from entering_avg using the same thresholds
# as getDivisionFromAverage(): A>=208, B>=190, C>=170, D>=150, E>=0.

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

echo "Backfilling division from entering_avg in database: $db_name"

run_sql() {
  if [[ -n "$db_pass" ]]; then
    MYSQL_PWD="$db_pass" mysql "${MYSQL_ARGS[@]}" -N -s "$db_name" <<< "$1"
  else
    mysql "${MYSQL_ARGS[@]}" -N -s "$db_name" <<< "$1"
  fi
}

NULL_COUNT=$(run_sql "SELECT COUNT(*) FROM people WHERE division IS NULL")

if [[ "$NULL_COUNT" -eq 0 ]]; then
  echo "✓ All participants already have division set"
  echo "No backfill needed."
  exit 0
fi

echo "Found $NULL_COUNT participant(s) with NULL division"

UPDATED=$(run_sql "
UPDATE people p
JOIN (
    SELECT pid, MAX(entering_avg) as entering_avg
    FROM scores
    WHERE entering_avg IS NOT NULL
    GROUP BY pid
) s ON s.pid = p.pid
SET p.division = CASE
    WHEN s.entering_avg >= 208 THEN 'A'
    WHEN s.entering_avg >= 190 THEN 'B'
    WHEN s.entering_avg >= 170 THEN 'C'
    WHEN s.entering_avg >= 150 THEN 'D'
    WHEN s.entering_avg >= 0 THEN 'E'
    ELSE NULL
END
WHERE p.division IS NULL;
SELECT ROW_COUNT();
")

echo "✓ Updated $UPDATED participant(s) with division from entering_avg"

STILL_NULL=$(run_sql "SELECT COUNT(*) FROM people WHERE division IS NULL")
if [[ "$STILL_NULL" -gt 0 ]]; then
  echo "  $STILL_NULL participant(s) still have NULL division (no entering_avg on file)"
fi

echo ""
echo "Division breakdown:"
run_sql "SELECT COALESCE(division, 'NULL') as division_value, COUNT(*) as cnt FROM people GROUP BY division ORDER BY division"
