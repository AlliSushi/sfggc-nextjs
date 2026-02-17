const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const MIGRATION_SCRIPT = path.join(
  process.cwd(),
  "backend/scripts/migrations/add-division-column.sh"
);

describe("Division column migration", () => {
  test("Given the migration script, when checking file, then it exists and is executable", () => {
    assert.ok(
      fs.existsSync(MIGRATION_SCRIPT),
      "Migration script must exist at backend/scripts/migrations/add-division-column.sh"
    );

    const stats = fs.statSync(MIGRATION_SCRIPT);
    assert.ok(
      stats.mode & fs.constants.S_IXUSR,
      "Migration script must be executable"
    );
  });

  test("Given the migration script, when checking idempotency, then it verifies whether division column already exists", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    assert.ok(
      content.includes("information_schema.COLUMNS"),
      "Migration must check information_schema for existing column"
    );
    assert.ok(
      content.includes("COLUMN_NAME = 'division'"),
      "Migration must specifically check for division column"
    );
    assert.ok(
      content.includes("already exists") && content.includes("exit 0"),
      "Migration must exit early when division column already exists"
    );
  });

  test("Given the migration script, when adding the schema change, then it adds division varchar(1) to people table", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");
    assert.ok(
      content.match(/ALTER TABLE people ADD COLUMN division varchar\(1\)/i),
      "Migration must add division varchar(1) column to people table"
    );
  });
});
