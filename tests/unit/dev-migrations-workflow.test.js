const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RUN_MIGRATIONS_SCRIPT = path.join(
  process.cwd(),
  "scripts/dev/run-portal-migrations.sh"
);
const INIT_DB_SCRIPT = path.join(
  process.cwd(),
  "scripts/dev/init-portal-db.sh"
);

describe("Dev migration workflow", () => {
  test("Given the dev migration runner, when checking file metadata, then it exists and is executable", () => {
    assert.ok(
      fs.existsSync(RUN_MIGRATIONS_SCRIPT),
      "scripts/dev/run-portal-migrations.sh must exist"
    );
    const stats = fs.statSync(RUN_MIGRATIONS_SCRIPT);
    assert.ok(
      stats.mode & fs.constants.S_IXUSR,
      "scripts/dev/run-portal-migrations.sh must be executable"
    );
  });

  test("Given the dev migration runner, when checking source, then it discovers and executes migrations in sorted order", () => {
    const source = fs.readFileSync(RUN_MIGRATIONS_SCRIPT, "utf-8");
    assert.ok(
      source.includes("backend/scripts/migrations"),
      "runner must target backend/scripts/migrations"
    );
    assert.ok(
      source.includes('find "$MIGRATIONS_DIR" -type f -name "*.sh" | sort'),
      "runner must discover migration scripts using sorted file order"
    );
    assert.ok(
      source.includes("while IFS= read -r migration; do"),
      "runner must use a bash-3-compatible read loop for migration collection"
    );
    assert.ok(
      !source.includes("mapfile"),
      "runner must not use mapfile because macOS default bash does not support it"
    );
    assert.ok(
      source.includes('for migration in "${migrations[@]}"'),
      "runner must iterate through the collected migrations"
    );
    assert.ok(
      source.includes('bash "$migration"'),
      "runner must execute each migration script"
    );
  });

  test("Given local DB initialization, when running init script, then it invokes the dev migration runner", () => {
    const source = fs.readFileSync(INIT_DB_SCRIPT, "utf-8");
    assert.ok(
      source.includes("Running portal migrations..."),
      "init script should announce migration execution"
    );
    assert.ok(
      source.includes('bash "$PROJECT_ROOT/scripts/dev/run-portal-migrations.sh"'),
      "init script must run scripts/dev/run-portal-migrations.sh after schema load"
    );
  });
});
