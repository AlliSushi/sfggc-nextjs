const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const MIGRATION_SCRIPT = path.join(
  process.cwd(),
  "backend/scripts/migrations/add-nickname-column.sh"
);

describe("Nickname column migration", () => {
  test("Given the migration script, when checking file, then it exists and is executable", () => {
    assert.ok(
      fs.existsSync(MIGRATION_SCRIPT),
      "Migration script must exist at backend/scripts/migrations/add-nickname-column.sh"
    );

    const stats = fs.statSync(MIGRATION_SCRIPT);
    assert.ok(
      stats.mode & fs.constants.S_IXUSR,
      "Migration script must be executable"
    );
  });

  test("Given the migration script, when checking logic, then it verifies column existence before adding", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Must check if column already exists (idempotent)
    assert.ok(
      content.includes("information_schema.COLUMNS"),
      "Migration must check information_schema for existing column"
    );

    assert.ok(
      content.includes("COLUMN_NAME = 'nickname'"),
      "Migration must specifically check for nickname column"
    );

    // Must exit early if column exists
    const hasExitLogic = content.match(/if \[\[.*COLUMN_EXISTS.*\]\]/i) &&
                         content.includes("exit 0") &&
                         content.includes("already exists");
    assert.ok(
      hasExitLogic,
      "Migration must exit early if column already exists (idempotent)"
    );
  });

  test("Given the migration script, when adding column, then it uses ALTER TABLE with correct syntax", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Must use ALTER TABLE ADD COLUMN
    assert.ok(
      content.match(/ALTER TABLE people ADD COLUMN nickname/i),
      "Migration must use ALTER TABLE ADD COLUMN syntax"
    );

    // Must specify column type as text
    assert.ok(
      content.match(/nickname text/i),
      "Migration must specify nickname as text type"
    );

    // Must position after last_name
    assert.ok(
      content.match(/AFTER last_name/i),
      "Migration must add nickname column after last_name"
    );
  });

  test("Given the migration script, when handling credentials, then it supports both password and passwordless connections", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Must handle password case
    assert.ok(
      content.includes('if [[ -n "$db_pass" ]]'),
      "Migration must check for database password"
    );

    assert.ok(
      content.includes('MYSQL_PWD="$db_pass"'),
      "Migration must use MYSQL_PWD for authenticated connections"
    );

    // Must handle passwordless case with else branch
    const passwordBranches = content.match(/if \[\[ -n "\$db_pass" \]\][\s\S]*?else[\s\S]*?fi/g);
    assert.ok(
      passwordBranches && passwordBranches.length >= 2,
      "Migration must have at least 2 if/else blocks for password handling (check + execute)"
    );
  });

  test("Given the migration script, when connecting to localhost, then it uses Unix socket authentication", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Must detect localhost
    assert.ok(
      content.includes('if [[ "${db_host}" == "localhost"') || content.includes('if [[ "$db_host" == "localhost"'),
      "Migration must detect localhost connections"
    );

    // Must use Unix socket for localhost
    assert.ok(
      content.includes("MYSQL_SOCKET") && content.includes("--socket"),
      "Migration must use Unix socket for localhost (avoids ERROR 1698)"
    );

    // Must check common socket locations
    assert.ok(
      content.includes("/tmp/mysql.sock") || content.includes("/opt/homebrew/var/mysql/mysql.sock"),
      "Migration must check common Unix socket locations"
    );

    // Must use MYSQL_ARGS array
    assert.ok(
      content.includes("MYSQL_ARGS"),
      "Migration must use MYSQL_ARGS array for connection parameters"
    );
  });

  test("Given the migration script, when loading configuration, then it sources .env.local from project root", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Must locate project root
    assert.ok(
      content.includes('PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"'),
      "Migration must calculate PROJECT_ROOT path correctly"
    );

    // Must source .env.local or .env
    assert.ok(
      content.includes("source") && content.includes(".env"),
      "Migration must source environment file"
    );

    // Must validate PORTAL_DATABASE_URL exists
    assert.ok(
      content.includes('if [[ -z "${PORTAL_DATABASE_URL:-}" ]]'),
      "Migration must validate PORTAL_DATABASE_URL is set"
    );
  });

  test("Given the migration script, when providing output, then it gives clear success/failure messages", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Must indicate when column already exists
    assert.ok(
      content.includes("already exists"),
      "Migration must indicate when column already exists"
    );

    // Must indicate success
    assert.ok(
      content.includes("Successfully added") || content.includes("Migration complete"),
      "Migration must indicate successful completion"
    );

    // Must indicate what it's doing
    assert.ok(
      content.includes("Adding nickname column"),
      "Migration must describe what operation is being performed"
    );
  });
});
