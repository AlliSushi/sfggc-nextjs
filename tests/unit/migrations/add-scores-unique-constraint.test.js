const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const MIGRATION_SCRIPT = path.join(
  process.cwd(),
  "backend/scripts/migrations/add-scores-unique-constraint.sh"
);

describe("Migration: add-scores-unique-constraint.sh", () => {
  test("Given migration script, when checked, then file exists and is executable", () => {
    assert.ok(
      fs.existsSync(MIGRATION_SCRIPT),
      "Migration script must exist at backend/scripts/migrations/add-scores-unique-constraint.sh"
    );

    const stats = fs.statSync(MIGRATION_SCRIPT);
    const isExecutable = (stats.mode & 0o111) !== 0;
    assert.ok(
      isExecutable,
      "Migration script must be executable (chmod +x)"
    );
  });

  test("Given migration script, when script runs, then it is idempotent (exits early if already applied)", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Should check if unique constraint exists
    const checksExistence = script.includes("pid_event_unique");
    const hasIdempotentCheck = script.includes("information_schema.STATISTICS");
    const exitsEarly = script.match(/if.*EXISTS.*exit 0/is);

    assert.ok(
      checksExistence && hasIdempotentCheck && exitsEarly,
      "Migration must check if pid_event_unique constraint exists and exit 0 if present"
    );
  });

  test("Given migration script, when removing duplicates, then it keeps the most recent record", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Should delete duplicates based on updated_at timestamp
    const deletesDuplicates = script.includes("DELETE s1 FROM scores s1");
    const joinsOnPidEvent = script.match(/s1.pid = s2.pid AND s1.event_type = s2.event_type/);
    const keepsRecent = script.includes("s1.updated_at < s2.updated_at");

    assert.ok(
      deletesDuplicates && joinsOnPidEvent && keepsRecent,
      "Migration must DELETE duplicate scores, keeping only the most recent based on updated_at"
    );
  });

  test("Given migration script, when adding constraint, then it creates unique index on (pid, event_type)", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Should add unique index on pid and event_type
    const addsUniqueIndex = script.match(/ADD UNIQUE INDEX pid_event_unique/i);
    const onPidEvent = script.match(/\(pid, event_type\)/);

    assert.ok(
      addsUniqueIndex && onPidEvent,
      "Migration must ADD UNIQUE INDEX pid_event_unique (pid, event_type)"
    );
  });

  test("Given migration script, when executing, then it handles password correctly", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Should use MYSQL_PWD environment variable when password is present
    const checksPwd = script.match(/if.*-n.*db_pass/i);
    const setsMysqlPwd = script.includes("MYSQL_PWD=");

    assert.ok(
      checksPwd && setsMysqlPwd,
      "Migration must set MYSQL_PWD when db_pass is present"
    );
  });

  test("Given migration script, when running on localhost, then it uses Unix socket authentication", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Should detect localhost and use socket
    const detectsLocalhost = script.match(/if.*localhost.*127\.0\.0\.1/);
    const usesSocket = script.includes("--socket");
    const fallsBackToTcp = script.includes("--protocol=tcp");

    assert.ok(
      detectsLocalhost && usesSocket && fallsBackToTcp,
      "Migration must detect localhost, try Unix socket first, fallback to TCP"
    );
  });

  test("Given migration script, when loading environment, then it sources .env.local", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Should load .env.local from project root
    const loadsEnvLocal = script.includes("source");
    const checksEnvLocal = script.match(/\.env\.local/);
    const exitsIfMissing = script.match(/\.env\.local.*not found.*exit 1/is);

    assert.ok(
      loadsEnvLocal && checksEnvLocal && exitsIfMissing,
      "Migration must source .env.local and exit if not found"
    );
  });

  test("Given migration script, when completed, then it outputs success message", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Should echo success messages
    const outputsSuccess = script.includes("Migration completed successfully");
    const describesChanges = script.includes("Removed duplicate") && script.includes("Added unique constraint");

    assert.ok(
      outputsSuccess && describesChanges,
      "Migration must output success message describing what was done"
    );
  });
});
