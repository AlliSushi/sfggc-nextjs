const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

/**
 * BDD tests for foreign key index migration script.
 *
 * This migration adds performance indexes to foreign key columns
 * that are frequently used in WHERE clauses and JOINs:
 * - people(tnmt_id) - team lookups
 * - people(did) - doubles pair lookups
 * - doubles_pairs(pid) - participant lookups
 * - doubles_pairs(partner_pid) - partner lookups
 * - scores(pid) - score lookups
 * - admins(phone) - phone lookups
 *
 * The migration must be idempotent (safe to run multiple times)
 * using CREATE INDEX IF NOT EXISTS syntax.
 */

const MIGRATION_SCRIPT = path.join(
  process.cwd(),
  "backend/scripts/migrations/add-foreign-key-indexes.sh"
);

describe("Foreign key indexes migration", () => {
  test("Given the migration script, when checking file, then it exists and is executable", () => {
    assert.ok(
      fs.existsSync(MIGRATION_SCRIPT),
      "Migration script must exist at backend/scripts/migrations/add-foreign-key-indexes.sh"
    );

    const stats = fs.statSync(MIGRATION_SCRIPT);
    assert.ok(
      stats.mode & fs.constants.S_IXUSR,
      "Migration script must be executable (chmod +x)"
    );
  });

  test("Given the migration script, when creating indexes, then it uses CREATE INDEX IF NOT EXISTS for idempotency", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Must use IF NOT EXISTS for idempotent migrations
    const hasIdempotentSyntax = content.match(/CREATE INDEX IF NOT EXISTS/gi);

    assert.ok(
      hasIdempotentSyntax && hasIdempotentSyntax.length >= 6,
      "Migration must use 'CREATE INDEX IF NOT EXISTS' for all 6 indexes (idempotent)"
    );
  });

  test("Given the migration script, when adding people table indexes, then it creates indexes on tnmt_id and did", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Index on people.tnmt_id
    assert.ok(
      content.match(/CREATE INDEX IF NOT EXISTS.*people.*tnmt_id/i),
      "Migration must create index on people(tnmt_id)"
    );

    // Index on people.did
    assert.ok(
      content.match(/CREATE INDEX IF NOT EXISTS.*people.*did/i),
      "Migration must create index on people(did)"
    );
  });

  test("Given the migration script, when adding doubles_pairs indexes, then it creates indexes on pid and partner_pid", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Index on doubles_pairs.pid
    assert.ok(
      content.match(/CREATE INDEX IF NOT EXISTS.*doubles_pairs.*pid/i),
      "Migration must create index on doubles_pairs(pid)"
    );

    // Index on doubles_pairs.partner_pid
    assert.ok(
      content.match(/CREATE INDEX IF NOT EXISTS.*doubles_pairs.*partner_pid/i),
      "Migration must create index on doubles_pairs(partner_pid)"
    );
  });

  test("Given the migration script, when adding scores table index, then it creates index on pid", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Index on scores.pid
    assert.ok(
      content.match(/CREATE INDEX IF NOT EXISTS.*scores.*pid/i),
      "Migration must create index on scores(pid)"
    );
  });

  test("Given the migration script, when adding admins table index, then it creates index on phone", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Index on admins.phone
    assert.ok(
      content.match(/CREATE INDEX IF NOT EXISTS.*admins.*phone/i),
      "Migration must create index on admins(phone)"
    );
  });

  test("Given the migration script, when creating all indexes, then it creates exactly 6 indexes", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    const createIndexStatements = content.match(/CREATE INDEX IF NOT EXISTS/gi) || [];

    assert.equal(
      createIndexStatements.length,
      6,
      "Migration must create exactly 6 indexes (people.tnmt_id, people.did, doubles_pairs.pid, " +
      "doubles_pairs.partner_pid, scores.pid, admins.phone)"
    );
  });

  test("Given the migration script, when naming indexes, then it uses descriptive names", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Index names should indicate table and column (e.g., idx_people_tnmt_id)
    const indexNamingPattern = /CREATE INDEX IF NOT EXISTS\s+(idx_\w+)/gi;
    const matches = [...content.matchAll(indexNamingPattern)];

    assert.ok(
      matches.length >= 6,
      "All index names should follow idx_* naming convention"
    );

    // Check that each index name is descriptive
    const indexNames = matches.map(m => m[1]);
    assert.ok(
      indexNames.some(name => name.includes("people") && name.includes("tnmt")),
      "Index name should indicate people.tnmt_id"
    );
    assert.ok(
      indexNames.some(name => name.includes("people") && name.includes("did")),
      "Index name should indicate people.did"
    );
    assert.ok(
      indexNames.some(name => name.includes("doubles") && name.includes("pid")),
      "Index name should indicate doubles_pairs.pid"
    );
    assert.ok(
      indexNames.some(name => name.includes("doubles") && name.includes("partner")),
      "Index name should indicate doubles_pairs.partner_pid"
    );
    assert.ok(
      indexNames.some(name => name.includes("scores") && name.includes("pid")),
      "Index name should indicate scores.pid"
    );
    assert.ok(
      indexNames.some(name => name.includes("admins") && name.includes("phone")),
      "Index name should indicate admins.phone"
    );
  });

  test("Given the migration script, when handling credentials, then it supports both password and passwordless connections", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Must handle password case
    assert.ok(
      content.includes('if [[ -n "$db_pass" ]]') || content.includes('if [[ -n "${db_pass}" ]]'),
      "Migration must check for database password"
    );

    assert.ok(
      content.includes('MYSQL_PWD="$db_pass"') || content.includes('MYSQL_PWD="${db_pass}"'),
      "Migration must use MYSQL_PWD for authenticated connections"
    );

    // Must handle passwordless case
    assert.ok(
      content.includes("else") && content.includes("fi"),
      "Migration must have if/else logic for password handling"
    );
  });

  test("Given the migration script, when connecting to localhost, then it uses Unix socket authentication", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Must detect localhost
    assert.ok(
      content.includes('if [[ "${db_host}" == "localhost"') ||
      content.includes('if [[ "$db_host" == "localhost"'),
      "Migration must detect localhost connections"
    );

    // Must use Unix socket for localhost
    assert.ok(
      (content.includes("MYSQL_SOCKET") || content.includes("socket")) &&
      content.includes("--socket"),
      "Migration must use Unix socket for localhost connections"
    );

    // Must check common socket locations
    assert.ok(
      content.includes("/tmp/mysql.sock") ||
      content.includes("/opt/homebrew/var/mysql/mysql.sock"),
      "Migration must check common Unix socket locations"
    );
  });

  test("Given the migration script, when loading configuration, then it sources .env.local from project root", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Must locate project root
    assert.ok(
      content.includes('PROJECT_ROOT="$(cd') && content.includes('&& pwd)"'),
      "Migration must calculate PROJECT_ROOT path"
    );

    // Must source .env.local or .env
    assert.ok(
      content.includes("source") && content.includes(".env"),
      "Migration must source environment file"
    );

    // Must validate PORTAL_DATABASE_URL exists
    assert.ok(
      content.includes('if [[ -z "${PORTAL_DATABASE_URL') ||
      content.includes('if [[ -z "$PORTAL_DATABASE_URL'),
      "Migration must validate PORTAL_DATABASE_URL is set"
    );
  });

  test("Given the migration script, when executing, then it provides clear success/failure messages", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Must indicate what it's doing
    assert.ok(
      content.toLowerCase().includes("adding") ||
      content.toLowerCase().includes("creating") ||
      content.toLowerCase().includes("index"),
      "Migration must describe what operation is being performed"
    );

    // Must indicate success
    assert.ok(
      content.includes("Successfully") ||
      content.includes("complete") ||
      content.includes("done"),
      "Migration must indicate successful completion"
    );

    // Should handle errors gracefully
    assert.ok(
      content.includes("error") || content.includes("Error") || content.includes("ERROR"),
      "Migration should include error handling messages"
    );
  });

  test("Given the migration script, when executing SQL, then it uses multipleStatements or executes each CREATE INDEX separately", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Either executes SQL in a batch or has multiple mysql calls
    const hasMultipleExecutions =
      (content.match(/mysql|mariadb/gi) || []).length > 1 ||
      content.includes("multipleStatements") ||
      content.match(/CREATE INDEX.*;\s*CREATE INDEX/i);

    assert.ok(
      hasMultipleExecutions || content.match(/EOF[\s\S]*CREATE INDEX[\s\S]*CREATE INDEX[\s\S]*EOF/),
      "Migration must execute all CREATE INDEX statements (either in batch or separately)"
    );
  });

  test("Given the migration script, when handling errors, then it exits with non-zero status on failure", () => {
    const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Should have error exit logic
    const hasErrorExit =
      content.includes("exit 1") ||
      content.includes("set -e") || // Exit on error
      content.match(/\|\|\s*exit/);

    assert.ok(
      hasErrorExit,
      "Migration must exit with non-zero status on failure for CI/CD integration"
    );
  });
});
