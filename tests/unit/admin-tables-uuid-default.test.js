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
const ADMINS_API = path.join(
  process.cwd(),
  "src/pages/api/portal/admins/index.js"
);
const REQUEST_RESET_API = path.join(
  process.cwd(),
  "src/pages/api/portal/admin/request-reset.js"
);
const ADMIN_DETAIL_API = path.join(
  process.cwd(),
  "src/pages/api/portal/admins/[id].js"
);
const PORTAL_API_TESTS = path.join(
  process.cwd(),
  "tests/unit/portal-api.test.js"
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

describe("admin creation API explicit UUID handling", () => {
  test("Given admin creation API, when inserting into admins table, then id field is explicitly provided", () => {
    const src = fs.readFileSync(ADMINS_API, "utf-8");

    // Should generate UUID for admin id
    assert.match(src, /const adminId = crypto\.randomUUID\(\)/);

    // Should include id in INSERT column list
    assert.match(src, /insert into admins \(id,/i);

    // Should provide adminId in values
    assert.match(src, /\[[\s\S]*?adminId,/);
  });

  test("Given admin creation API, when inserting into admin_password_resets, then id field is explicitly provided", () => {
    const src = fs.readFileSync(ADMINS_API, "utf-8");

    // Should generate UUID for reset token id
    assert.match(src, /const resetTokenId = crypto\.randomUUID\(\)/);

    // Should include id in INSERT column list
    assert.match(src, /insert into admin_password_resets \(id, admin_id,/i);

    // Should provide resetTokenId in values
    assert.match(src, /\[resetTokenId, adminId,/);
  });

  test("Given admin creation API, when transaction executes, then both inserts provide explicit UUIDs", () => {
    const src = fs.readFileSync(ADMINS_API, "utf-8");

    // Should NOT rely on database default values
    // Both UUIDs should be generated before the transaction
    const beforeTransaction = src.match(/const adminId = crypto\.randomUUID[\s\S]*?const resetTokenId = crypto\.randomUUID[\s\S]*?await withTransaction/);
    assert.ok(beforeTransaction, "Both UUIDs should be generated before transaction starts");
  });

  test("Given password reset request API, when creating reset token, then id field is explicitly provided", () => {
    const src = fs.readFileSync(REQUEST_RESET_API, "utf-8");

    // Should include id in INSERT column list
    assert.match(src, /insert into admin_password_resets \(id,/i);

    // Should provide explicit UUID value (resetId variable)
    assert.match(src, /const resetId = crypto\.randomUUID\(\)/);
  });
});

describe("test fixtures explicit UUID handling", () => {
  test("Given test fixtures, when inserting password resets, then id is generated via uuid() function", () => {
    const src = fs.readFileSync(PORTAL_API_TESTS, "utf-8");

    // Test INSERT should use uuid() function in SELECT
    assert.match(src, /insert into admin_password_resets \(id, admin_id,/i);
    assert.match(src, /select uuid\(\), id,/i);
  });
});

describe("admin edit/delete API explicit UUID handling", () => {
  test("Given admin edit handler (PATCH), when updating admin and logging action, then admin_actions INSERT includes explicit UUID", () => {
    const src = fs.readFileSync(ADMIN_DETAIL_API, "utf-8");

    // Should generate UUID for admin action
    assert.match(src, /const actionId = crypto\.randomUUID\(\)/);

    // Should include id in admin_actions INSERT column list
    assert.match(src, /insert into admin_actions \(id, admin_email, action, details\)/i);

    // Should provide actionId in values for modify_admin action
    const patchHandler = src.match(/async function handlePatch[\s\S]*?(?=async function|export default)/);
    assert.ok(patchHandler, "handlePatch function should exist");
    assert.match(patchHandler[0], /actionId/);
    assert.match(patchHandler[0], /modify_admin/);
  });

  test("Given admin delete handler (DELETE), when revoking admin and logging action, then admin_actions INSERT includes explicit UUID", () => {
    const src = fs.readFileSync(ADMIN_DETAIL_API, "utf-8");

    // Should generate UUID for admin action
    assert.match(src, /const actionId = crypto\.randomUUID\(\)/);

    // Should include id in admin_actions INSERT column list
    assert.match(src, /insert into admin_actions \(id, admin_email, action, details\)/i);

    // Should provide actionId in values for revoke_admin action
    const deleteHandler = src.match(/async function handleDelete[\s\S]*?(?=export default)/);
    assert.ok(deleteHandler, "handleDelete function should exist");
    assert.match(deleteHandler[0], /actionId/);
    assert.match(deleteHandler[0], /revoke_admin/);
  });

  test("Given admin edit/delete handlers, when executing transactions, then actionId is generated before transaction starts", () => {
    const src = fs.readFileSync(ADMIN_DETAIL_API, "utf-8");

    // Extract both handlers
    const patchHandler = src.match(/async function handlePatch[\s\S]*?(?=async function handleDelete)/);
    const deleteHandler = src.match(/async function handleDelete[\s\S]*?(?=export default)/);

    assert.ok(patchHandler, "handlePatch should exist");
    assert.ok(deleteHandler, "handleDelete should exist");

    // PATCH handler should generate actionId before withTransaction
    const patchBeforeTransaction = patchHandler[0].match(/const actionId = crypto\.randomUUID[\s\S]*?await withTransaction/);
    assert.ok(patchBeforeTransaction, "PATCH handler should generate actionId before transaction");

    // DELETE handler should generate actionId before withTransaction
    const deleteBeforeTransaction = deleteHandler[0].match(/const actionId = crypto\.randomUUID[\s\S]*?await withTransaction/);
    assert.ok(deleteBeforeTransaction, "DELETE handler should generate actionId before transaction");
  });
});
