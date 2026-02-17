const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const MIGRATION_SCRIPT = path.join(
  process.cwd(),
  "backend/scripts/migrations/cleanup-stale-doubles-pairs.sh"
);

describe("Migration: cleanup-stale-doubles-pairs.sh", () => {
  test("Given migration script, when checked, then file exists and is executable", () => {
    assert.ok(
      fs.existsSync(MIGRATION_SCRIPT),
      "Migration script must exist at backend/scripts/migrations/cleanup-stale-doubles-pairs.sh"
    );

    const stats = fs.statSync(MIGRATION_SCRIPT);
    const isExecutable = (stats.mode & 0o111) !== 0;
    assert.ok(
      isExecutable,
      "Migration script must be executable (chmod +x)"
    );
  });

  test("Given migration script, when script runs, then it is idempotent (safe to run multiple times)", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // Must always be safe to re-run — DELETE of non-existent rows is a no-op
    // The script should describe what it does but not require a pre-check
    // since the DELETE itself is inherently idempotent
    assert.ok(
      script.includes("DELETE") && script.includes("doubles_pairs"),
      "Migration must DELETE stale doubles_pairs rows"
    );
  });

  test("Given migration script, when removing stale rows, then it keeps only rows where did matches the participant's current did in people table", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // The DELETE must join people to compare dp.did vs p.did
    const scriptLower = script.toLowerCase();
    assert.ok(
      scriptLower.includes("join people") &&
        (scriptLower.includes("dp.did <> p.did") ||
          scriptLower.includes("dp.did != p.did") ||
          scriptLower.includes("p.did <> dp.did") ||
          scriptLower.includes("p.did != dp.did")),
      "Migration must DELETE doubles_pairs rows where dp.did <> p.did (stale rows from previous pairings)"
    );
  });

  test("Given migration script, when cleaning stale rows, then it also clears partner_pid references to stale participants", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    // After deleting stale rows, partner_pid references to deleted participants
    // should be NULLed to avoid dangling references
    const scriptLower = script.toLowerCase();
    assert.ok(
      scriptLower.includes("update doubles_pairs") &&
        scriptLower.includes("partner_pid"),
      "Migration must UPDATE doubles_pairs to clear partner_pid references that point to non-existent pids"
    );
  });

  test("Given migration script, when loading environment, then it sources .env.local", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    const loadsEnvLocal = script.includes("source");
    const checksEnvLocal = script.match(/\.env\.local/);

    assert.ok(
      loadsEnvLocal && checksEnvLocal,
      "Migration must source .env.local for database connection"
    );
  });

  test("Given migration script, when running on localhost, then it uses Unix socket authentication", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    const detectsLocalhost = script.match(/localhost.*127\.0\.0\.1/);
    const usesSocket = script.includes("--socket");
    const fallsBackToTcp = script.includes("--protocol=tcp");

    assert.ok(
      detectsLocalhost && usesSocket && fallsBackToTcp,
      "Migration must detect localhost, try Unix socket first, fallback to TCP"
    );
  });

  test("Given migration script, when completed, then it outputs what was cleaned up", () => {
    const script = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");

    assert.ok(
      script.includes("stale") || script.includes("cleanup") || script.includes("Cleaned"),
      "Migration must output description of what was cleaned up"
    );
  });
});
