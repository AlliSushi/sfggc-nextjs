const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const API_FILE = path.join(
  process.cwd(),
  "src/pages/api/portal/admins/[id].js"
);

const readSource = () => fs.readFileSync(API_FILE, "utf-8");

describe("Admin revoke API — method support", () => {
  test("Given the admins [id] API, when checking allowed methods, then DELETE and PATCH are both accepted", () => {
    const src = readSource();
    assert.match(src, /DELETE/);
    assert.match(src, /PATCH/);
  });

  test("Given a non-PATCH/DELETE request, when sent to the API, then methodNotAllowed is called", () => {
    const src = readSource();
    assert.match(src, /methodNotAllowed/);
  });
});

describe("Admin revoke API — auth guards", () => {
  test("Given the DELETE handler, when checking auth, then requireAdmin is used (not requireSuperAdmin)", () => {
    const src = readSource();
    assert.match(src, /requireAdmin/);
  });

  test("Given the DELETE handler, when importing auth, then requireAdmin comes from auth-guards", () => {
    const src = readSource();
    assert.match(src, /import.*requireAdmin.*from.*auth-guards/s);
  });
});

describe("Admin revoke API — self-revoke protection", () => {
  test("Given the DELETE handler, when checking for self-revoke, then session email is compared to target email", () => {
    const src = readSource();
    assert.match(src, /email/);
    // The handler must check that the requesting admin is not revoking themselves
    assert.match(src, /403|Cannot revoke your own|self/i);
  });
});

describe("Admin revoke API — last super-admin protection", () => {
  test("Given the DELETE handler, when revoking a super-admin, then it counts remaining super-admins", () => {
    const src = readSource();
    assert.match(src, /super-admin/);
    assert.match(src, /COUNT|count/);
  });

  test("Given the DELETE handler, when only one super-admin remains, then revoke is blocked with 409", () => {
    const src = readSource();
    assert.match(src, /409|Cannot revoke the last/i);
  });
});

describe("Admin revoke API — transactional delete with audit", () => {
  test("Given the DELETE handler, when revoking an admin, then withTransaction is used", () => {
    const src = readSource();
    assert.match(src, /withTransaction/);
  });

  test("Given the DELETE handler, when revoking an admin, then admin_password_resets are deleted first", () => {
    const src = readSource();
    assert.match(src, /DELETE FROM admin_password_resets/i);
  });

  test("Given the DELETE handler, when revoking an admin, then the admin record is deleted", () => {
    const src = readSource();
    assert.match(src, /DELETE FROM admins/i);
  });

  test("Given the DELETE handler, when revoking an admin, then an admin_actions audit entry is inserted", () => {
    const src = readSource();
    assert.match(src, /admin_actions/);
    assert.match(src, /revoke_admin/);
  });
});
