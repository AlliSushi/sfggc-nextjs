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
 * These tests verify all API route callers properly await auth guards.
 */

const projectRoot = process.cwd();
const API_ROOT = path.join(projectRoot, "src/pages/api/portal");

// All API route files that call requireSuperAdmin, requireAdmin, or requireParticipantMatchOrAdmin
const AUTH_GUARD_CALLERS = [
  "admins/[id]/index.js",
  "admins/[id]/force-password-change.js",
  "admins/index.js",
  "admins/lookup.js",
  "email-templates/index.js",
  "email-templates/[slug].js",
  "admin/audit.js",
  "admin/audit/clear.js",
  "admin/import-xml.js",
  "admin/import-lanes.js",
  "admin/lane-assignments.js",
  "admin/possible-issues.js",
  "participants/[pid].js",
  "participants/index.js",
  "participants/[pid]/audit.js",
];

const readApiFile = (relativePath) =>
  fs.readFileSync(path.join(API_ROOT, relativePath), "utf-8");

describe("Auth guard await correctness", () => {
  for (const filePath of AUTH_GUARD_CALLERS) {
    test(`Given ${filePath}, when calling an auth guard, then it awaits the async result`, () => {
      const content = readApiFile(filePath);
      const lines = content.split("\n");

      // Find lines that call auth guard functions (not imports)
      const callLines = lines.filter(
        (line) =>
          (line.includes("requireSuperAdmin(") ||
            line.includes("requireAdmin(") ||
            line.includes("requireParticipantMatchOrAdmin(")) &&
          !line.match(/^\s*(import|export|from)/)
      );

      assert.ok(
        callLines.length > 0,
        `${filePath} must have at least one auth guard call`
      );

      const nonAwaitedCalls = callLines.filter(
        (line) => !line.includes("await")
      );

      assert.equal(
        nonAwaitedCalls.length,
        0,
        `${filePath} has ${nonAwaitedCalls.length} auth guard call(s) missing await. ` +
          `Without await, auth is bypassed (Promise is truthy) and payload.email is undefined. ` +
          `Non-awaited lines:\n${nonAwaitedCalls.map((l) => `  ${l.trim()}`).join("\n")}`
      );
    });
  }
});
