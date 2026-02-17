const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MIGRATION_PATH = path.join(
  process.cwd(),
  "backend/scripts/migrations/add-optional-events-column.sh"
);

describe("add-optional-events-column migration", () => {
  test("Given migration scripts, when checking optional events migration, then file exists", () => {
    assert.ok(
      fs.existsSync(MIGRATION_PATH),
      "Migration script must exist at backend/scripts/migrations/add-optional-events-column.sh"
    );
  });

  test("Given the migration script, when checking schema change, then it adds people.optional_events tinyint default 0", () => {
    const content = fs.readFileSync(MIGRATION_PATH, "utf8");
    assert.match(content, /ALTER TABLE people ADD COLUMN IF NOT EXISTS optional_events tinyint\(1\)/i);
    assert.match(content, /default\s+0/i);
  });

  test("Given the migration script, when checking idempotency, then it checks for existing optional_events column", () => {
    const content = fs.readFileSync(MIGRATION_PATH, "utf8");
    assert.ok(content.includes("COLUMN_NAME = 'optional_events'"));
  });
});
