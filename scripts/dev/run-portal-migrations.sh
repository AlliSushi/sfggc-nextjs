#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/backend/scripts/migrations"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "No migrations directory found at $MIGRATIONS_DIR"
  exit 0
fi

if [[ -z "${PORTAL_DATABASE_URL:-}" ]]; then
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
  echo "Set PORTAL_DATABASE_URL before running migrations (or add it to .env.local)."
  exit 1
fi

migrations=()
while IFS= read -r migration; do
  migrations+=("$migration")
done < <(find "$MIGRATIONS_DIR" -type f -name "*.sh" | sort)

if [[ ${#migrations[@]} -eq 0 ]]; then
  echo "No migration scripts found in $MIGRATIONS_DIR"
  exit 0
fi

echo "Running ${#migrations[@]} portal migration(s)..."
for migration in "${migrations[@]}"; do
  migration_name="$(basename "$migration")"
  echo ""
  echo "→ $migration_name"
  bash "$migration"
done

echo ""
echo "All portal migrations completed."
