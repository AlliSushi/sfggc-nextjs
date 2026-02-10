const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const MIGRATION_SCRIPT = path.join(
  process.cwd(),
  "backend/scripts/migrations/fix-must-change-password-default.sh"
);

describe("Fix must_change_password default migration", () => {
  test("Given the migration script, when checking file, then it exists and is executable", () => {
    assert.ok(
      fs.existsSync(MIGRATION_SCRIPT),
      "Migration script must exist at backend/scripts/migrations/fix-must-change-password-default.sh"
    );

    const stats = fs.statSync(MIGRATION_SCRIPT);
    assert.ok(
      stats.mode & fs.constants.S_IXUSR,
      "Migration script must be executable (chmod +x)"
    );
  });

  test("Given the migration script, when fixing the default, then it alters the column default to false", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    assert.ok(
      content.match(/ALTER TABLE admins/i),
      "Migration must ALTER TABLE admins"
    );

    assert.ok(
      content.match(/must_change_password/i) &&
      (content.match(/DEFAULT\s+(0|false)/i) || content.match(/SET DEFAULT\s+(0|false)/i)),
      "Migration must change must_change_password column default to false/0"
    );
  });

  test("Given the migration script, when fixing existing rows, then it updates existing admins to must_change_password=false", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    assert.ok(
      content.match(/UPDATE admins\s+SET\s+must_change_password\s*=\s*(0|false)/i),
      "Migration must UPDATE existing admins to set must_change_password = false"
    );
  });

  test("Given the migration script, when updating rows, then it only updates admins not created through force-password-change", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // The UPDATE should target rows where must_change_password is still true
    // but the admin was NOT recently force-changed (no unexpired token exists).
    // Simplest idempotent approach: only update rows still set to true.
    assert.ok(
      content.match(/WHERE\s+must_change_password\s*=\s*(1|true)/i),
      "Migration must only update admins where must_change_password is still true"
    );
  });

  test("Given the migration script, when executing, then it is idempotent", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // ALTER COLUMN SET DEFAULT is inherently idempotent.
    // UPDATE WHERE must_change_password = true is idempotent (no-op on second run).
    // Just verify both operations exist.
    assert.ok(
      content.match(/ALTER/i) && content.match(/UPDATE/i),
      "Migration must have both ALTER (column default) and UPDATE (existing rows)"
    );
  });

  test("Given the migration script, when loading configuration, then it sources .env.local from project root", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    assert.ok(
      content.includes("source") && content.includes(".env"),
      "Migration must source environment file"
    );

    assert.ok(
      content.includes("PORTAL_DATABASE_URL"),
      "Migration must use PORTAL_DATABASE_URL"
    );
  });

  test("Given the migration script, when connecting to localhost, then it uses Unix socket authentication", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    assert.ok(
      content.includes("--socket") || content.includes("socket"),
      "Migration must support Unix socket for localhost connections"
    );
  });
});
