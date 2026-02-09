# Database Migrations

## Overview

The deployment system automatically runs database migrations during portal deployment. Migrations are executed after database initialization but before the super admin is created.

## How It Works

### Automatic Execution

When you deploy the portal, migrations run automatically:

```bash
# Standard portal deployment (migrations run automatically)
./deploy_scripts/deploy.sh --portal

# Skip migrations if needed (not recommended)
./deploy_scripts/deploy.sh --portal --skip-migrations
```

### Migration Discovery

The deployment system:
1. Looks for `*.sh` files in `backend/scripts/migrations/`
2. Sorts them alphabetically (so you can prefix with numbers: `001-add-column.sh`)
3. Executes each migration in order
4. Reports success/failure for each migration

### Idempotent Migrations

All migrations **must be idempotent** (safe to run multiple times). They should:
- Check if changes already exist before applying them
- Exit successfully if already applied
- Use `ALTER TABLE IF NOT EXISTS` or similar patterns

## Creating a Migration

### 1. Write the Migration Script

Create a new file in `backend/scripts/migrations/`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Load environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

for f in .env.local .env; do
  if [[ -f "$PROJECT_ROOT/$f" ]]; then
    set -a
    source "$PROJECT_ROOT/$f"
    set +a
    break
  fi
done

if [[ -z "${PORTAL_DATABASE_URL:-}" ]]; then
  echo "Error: PORTAL_DATABASE_URL not found"
  exit 1
fi

# Parse database connection
db_name=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.pathname.replace('/', ''));")
db_user=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.username || process.env.USER);")
db_host=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.hostname || 'localhost');")
db_port=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.port || '3306');")
db_pass=$(node -e "const url = new URL(process.env.PORTAL_DATABASE_URL); console.log(url.password || '');")

# Use Unix socket for localhost (avoids ERROR 1698 with root/socket auth on Homebrew MariaDB)
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

# Check if change already exists (idempotent check)
if [[ -n "$db_pass" ]]; then
  EXISTS=$(MYSQL_PWD="$db_pass" mysql "${MYSQL_ARGS[@]}" -N -s "$db_name" <<SQL
-- Your check query here
SELECT COUNT(*) FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = '$db_name'
  AND TABLE_NAME = 'your_table'
  AND COLUMN_NAME = 'your_column';
SQL
)
else
  EXISTS=$(mysql "${MYSQL_ARGS[@]}" -N -s "$db_name" <<SQL
-- Your check query here
SELECT COUNT(*) FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = '$db_name'
  AND TABLE_NAME = 'your_table'
  AND COLUMN_NAME = 'your_column';
SQL
)
fi

if [[ "$EXISTS" -gt 0 ]]; then
  echo "✓ Change already applied"
  exit 0
fi

echo "Applying migration..."

# Apply the migration
if [[ -n "$db_pass" ]]; then
  MYSQL_PWD="$db_pass" mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
-- Your migration SQL here
ALTER TABLE your_table ADD COLUMN your_column text;
SQL
else
  mysql "${MYSQL_ARGS[@]}" "$db_name" <<SQL
-- Your migration SQL here
ALTER TABLE your_table ADD COLUMN your_column text;
SQL
fi

echo "✓ Migration completed successfully"
```

### 2. Make It Executable

```bash
chmod +x backend/scripts/migrations/your-migration.sh
```

### 3. Test Locally

```bash
# Run the migration locally
bash backend/scripts/migrations/your-migration.sh

# Run it again to verify idempotency
bash backend/scripts/migrations/your-migration.sh
```

### 4. Write BDD Tests

Create a test in `tests/unit/migrations/`:

```javascript
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const MIGRATION_SCRIPT = path.join(
  process.cwd(),
  "backend/scripts/migrations/your-migration.sh"
);

describe("Your migration", () => {
  test("Given the migration script, when checking file, then it exists and is executable", () => {
    assert.ok(fs.existsSync(MIGRATION_SCRIPT), "Migration must exist");
    const stats = fs.statSync(MIGRATION_SCRIPT);
    assert.ok(stats.mode & fs.constants.S_IXUSR, "Migration must be executable");
  });

  test("Given the migration script, when checking logic, then it's idempotent", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");
    const hasCheck = content.includes("information_schema") ||
                     content.includes("IF NOT EXISTS");
    assert.ok(hasCheck, "Migration must check if change already exists");
  });

  // Add more tests for your specific migration...
});
```

### 5. Deploy

The migration will run automatically:

```bash
./deploy_scripts/deploy.sh --portal
```

## Migration Naming Conventions

Use descriptive names with optional numeric prefixes:

- `add-nickname-column.sh` - Simple descriptive name
- `001-add-nickname-column.sh` - Numbered for ordering
- `002-add-team-slug-index.sh` - Ensures execution order

## Troubleshooting

### Migration Failed During Deployment

If a migration fails during deployment:

1. **Check the error message** - The deployment log will show which migration failed and why
2. **SSH into the server** and run the migration manually:
   ```bash
   ssh user@server
   cd ~/htdocs/www.goldengateclassic.org/portal-app
   bash backend/scripts/migrations/your-migration.sh
   ```
3. **Fix the issue** and redeploy

### Skipping Migrations

Only skip migrations if absolutely necessary (e.g., during rollback):

```bash
./deploy_scripts/deploy.sh --portal --skip-migrations
```

### Running Migrations Manually

On the server:

```bash
# Run all migrations
for migration in backend/scripts/migrations/*.sh; do
  echo "Running $migration..."
  bash "$migration"
done

# Run a specific migration
bash backend/scripts/migrations/add-nickname-column.sh
```

## Best Practices

1. **Always test locally first** - Run migrations on your dev database before deploying
2. **Make them idempotent** - Migrations should be safe to run multiple times
3. **Keep them small** - One logical change per migration
4. **Use transactions** - Wrap complex migrations in SQL transactions when possible
5. **Add helpful output** - Echo what the migration is doing and whether it succeeded
6. **Document dependencies** - If a migration depends on another, document it in comments

## Example: Current Migrations

### add-nickname-column.sh

Adds the `nickname` column to the `people` table for displaying nicknames in the portal.

**What it does:**
- Checks if `nickname` column already exists
- Adds `nickname text` column after `last_name` if missing
- Safe to run multiple times

**Test:** `tests/unit/migrations/add-nickname-column.test.js`

### add-scores-unique-constraint.sh

Adds unique constraint on `scores(pid, event_type)` to enable idempotent XML imports.

**What it does:**
- Checks if unique index `pid_event_unique` already exists
- Removes duplicate score records (keeps most recent by `updated_at`)
- Adds unique constraint: `UNIQUE INDEX pid_event_unique (pid, event_type)`
- Enables `INSERT ... ON DUPLICATE KEY UPDATE` to work correctly

**Why needed:**
- Without unique constraint, each XML import created NEW score records
- Caused duplicate accumulation (multiple records per participant per event)
- Unique constraint makes imports idempotent (safe to run multiple times)

**Migration script location:** `backend/scripts/migrations/add-scores-unique-constraint.sh`

**Test:** `tests/unit/migrations/add-scores-unique-constraint.test.js` (8 BDD tests)

**Related features:**
- Book average and handicap calculation (`portal_architecture.md#book-average-and-handicap-management`)
- Scores table architecture (`portal_database_architecture.md#scores-table-book-average-and-handicap`)

## Migration Lifecycle

```
1. Developer creates migration script
2. Developer tests locally
3. Developer writes BDD test
4. Developer commits migration to repo
5. Deploy script syncs files to server
6. Deploy script runs migrations automatically
7. Each migration checks if already applied
8. Migration executes or skips if already done
9. Deployment continues
```

## Security Notes

- Migrations use the same `PORTAL_DATABASE_URL` from `.env.local`
- Credentials are never logged or displayed
- Migrations run with the same permissions as the portal app
- Use parameterized queries if migrations accept user input (rare)
