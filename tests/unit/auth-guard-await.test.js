const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

/**
 * BDD tests for auth guard await correctness.
 *
 * requireSuperAdmin and requireAdmin are async functions that return
 * the session payload (or null if unauthorized). If callers don't await
 * them, the return value is a Promise (always truthy), which:
 *   1. Bypasses authentication (the `if (!payload) return` check never triggers)
 *   2. Makes payload.email undefined, causing "Column 'admin_email' cannot be null"
 *
 * These tests auto-discover all API route files under src/pages/api/portal/
 * and verify that any file importing or using an auth guard does so correctly.
 */

const projectRoot = process.cwd();
const API_ROOT = path.join(projectRoot, "src/pages/api/portal");

const AUTH_GUARD_FUNCTIONS = [
  "requireSuperAdmin(",
  "requireAdmin(",
  "requireParticipantMatchOrAdmin(",
];

const DELEGATED_AUTH_HELPERS = [
  "handleAdminCsvImport(",
  "handleSuperAdminClear(",
];

/** Recursively find all .js files under a directory. */
const findJsFiles = (dir) => {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsFiles(fullPath));
    } else if (entry.name.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
};

/** Check if file content contains a direct (non-import) auth guard call. */
const hasDirectAuthGuardCall = (content) =>
  AUTH_GUARD_FUNCTIONS.some((fn) => {
    const lines = content.split("\n");
    return lines.some(
      (line) => line.includes(fn) && !line.match(/^\s*(import|export|from)/)
    );
  });

/** Check if file content delegates auth to a shared helper. */
const hasDelegatedAuth = (content) =>
  DELEGATED_AUTH_HELPERS.some((helper) => content.includes(helper));

/** Check if file content uses auth at all (direct or delegated). */
const usesAuth = (content) =>
  hasDirectAuthGuardCall(content) || hasDelegatedAuth(content);

const allApiFiles = findJsFiles(API_ROOT);
const apiRoutesUsingAuth = allApiFiles.filter((filePath) => {
  const content = fs.readFileSync(filePath, "utf-8");
  return usesAuth(content);
});

describe("Auth guard await correctness (auto-discovered)", () => {
  test("Given API routes directory, when scanned, then at least 15 routes use auth guards", () => {
    assert.ok(
      apiRoutesUsingAuth.length >= 15,
      `Expected at least 15 API routes using auth guards, found ${apiRoutesUsingAuth.length}. ` +
        `If routes were removed, lower this threshold. If new routes were added without auth, ` +
        `verify they genuinely don't need authentication.`
    );
  });

  for (const filePath of apiRoutesUsingAuth) {
    const relativePath = path.relative(API_ROOT, filePath);

    test(`Given ${relativePath}, when calling an auth guard, then it awaits the async result`, () => {
      const content = fs.readFileSync(filePath, "utf-8");

      // Routes that delegate to shared helpers are safe — the helper awaits internally
      if (hasDelegatedAuth(content) && !hasDirectAuthGuardCall(content)) {
        const helper = DELEGATED_AUTH_HELPERS.find((h) => content.includes(h));
        assert.ok(helper, `${relativePath} uses a delegated auth helper that awaits internally`);
        return;
      }

      const lines = content.split("\n");
      const callLines = lines.filter(
        (line) =>
          AUTH_GUARD_FUNCTIONS.some((fn) => line.includes(fn)) &&
          !line.match(/^\s*(import|export|from)/)
      );

      assert.ok(
        callLines.length > 0,
        `${relativePath} imports auth guards but has no call sites — verify it delegates correctly`
      );

      const nonAwaitedCalls = callLines.filter((line) => !line.includes("await"));

      assert.equal(
        nonAwaitedCalls.length,
        0,
        `${relativePath} has ${nonAwaitedCalls.length} auth guard call(s) missing await. ` +
          `Without await, auth is bypassed (Promise is truthy) and payload.email is undefined. ` +
          `Non-awaited lines:\n${nonAwaitedCalls.map((l) => `  ${l.trim()}`).join("\n")}`
      );
    });
  }
});
