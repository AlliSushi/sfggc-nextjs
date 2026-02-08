const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ADMINS_SERVER = path.join(
  process.cwd(),
  "src/utils/portal/admins-server.js"
);
const AUDIT_API = path.join(
  process.cwd(),
  "src/pages/api/portal/admin/audit.js"
);

describe("admin_password_resets id default", () => {
  test("Given the ensureAdminResetTables function, when checking schema migration, then admin_password_resets CREATE TABLE has DEFAULT uuid() on id", () => {
    const src = fs.readFileSync(ADMINS_SERVER, "utf-8");
    assert.match(src, /create\s+table\s+if\s+not\s+exists\s+admin_password_resets/i);
    assert.match(src, /admin_password_resets[\s\S]*default\s*\(\s*uuid\(\)\s*\)/i);
  });
});

describe("admin_actions id default", () => {
  test("Given the ensureAdminActionsTables function, when checking schema migration, then admin_actions CREATE TABLE has DEFAULT uuid() on id", () => {
    const src = fs.readFileSync(ADMINS_SERVER, "utf-8");
    assert.match(src, /create\s+table\s+if\s+not\s+exists\s+admin_actions/i);
    assert.match(src, /admin_actions[\s\S]*default\s*\(\s*uuid\(\)\s*\)/i);
  });

  test("Given the audit API, when checking ensure logic, then it uses ensureAdminActionsTables from admins-server", () => {
    const src = fs.readFileSync(AUDIT_API, "utf-8");
    assert.match(src, /ensureAdminActionsTables/);
    assert.match(src, /admins-server/);
  });
});
