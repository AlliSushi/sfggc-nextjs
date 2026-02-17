const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const FILE = path.join(
  process.cwd(),
  "src/utils/portal/admins-server.js"
);

const src = fs.readFileSync(FILE, "utf-8");

describe("admins-server.js — idempotent schema migrations", () => {
  test("Given ensureAdminTables, when checking for MODIFY COLUMN, then no MODIFY COLUMN statements exist in executable code", () => {
    // MODIFY COLUMN ... UNIQUE adds a new index on every call, causing
    // "Too many keys specified; max 64 keys allowed" after repeated invocations.
    // Strip block comments and single-line comments before checking.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(
      codeOnly,
      /alter\s+table.*modify\s+column/i,
      "MODIFY COLUMN statements accumulate indexes and must not be used in ensure functions"
    );
  });

  test("Given ensureAdminTables, when checking CREATE TABLE, then email column does not have inline UNIQUE in phone definition", () => {
    // The phone column should NOT have inline UNIQUE in CREATE TABLE because
    // we use a separate CREATE UNIQUE INDEX IF NOT EXISTS for phone instead.
    // Inline UNIQUE would create a second index alongside the named one.
    const createTableMatch = src.match(
      /create\s+table\s+if\s+not\s+exists\s+admins\s*\(([^;]+)\)/is
    );
    assert.ok(createTableMatch, "CREATE TABLE admins statement must exist");
    const tableBody = createTableMatch[1];
    const phoneCol = tableBody.match(/phone\s+text\s*(unique)?/i);
    assert.ok(phoneCol, "phone column must exist in CREATE TABLE");
    assert.notStrictEqual(
      phoneCol[1]?.toLowerCase(),
      "unique",
      "phone column must not have inline UNIQUE — use CREATE UNIQUE INDEX IF NOT EXISTS instead"
    );
  });

  test("Given ensureAdminTables, when checking indexes, then all CREATE INDEX statements use IF NOT EXISTS", () => {
    const createIndexStatements = src.match(/create\s+(unique\s+)?index\s+(?!if)/gi);
    assert.strictEqual(
      createIndexStatements,
      null,
      "All CREATE INDEX statements must use IF NOT EXISTS to be idempotent"
    );
  });

  test("Given the schema module, when checking for duplicate index cleanup, then dropDuplicateIndexes is defined", () => {
    assert.match(src, /dropDuplicateIndexes/);
  });

  test("Given ensureAdminTables, when called, then dropDuplicateIndexes is called for admins table", () => {
    assert.match(src, /dropDuplicateIndexes\s*\(\s*["']admins["']\s*\)/);
  });

  test("Given ensureAdminResetTables, when called, then dropDuplicateIndexes is called for admin_password_resets table", () => {
    assert.match(src, /dropDuplicateIndexes\s*\(\s*["']admin_password_resets["']\s*\)/);
  });

  test("Given ensureAdminActionsTables, when called, then dropDuplicateIndexes is called for admin_actions table", () => {
    assert.match(src, /dropDuplicateIndexes\s*\(\s*["']admin_actions["']\s*\)/);
  });
});
