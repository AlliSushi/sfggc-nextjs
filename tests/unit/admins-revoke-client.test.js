const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const loadAdminUtils = async () => {
  const fullPath = path.join(process.cwd(), "src/utils/portal/admins-client.js");
  const module = await import(pathToFileURL(fullPath));
  return module;
};

describe("canRevokeAdmin — basic revoke", () => {
  test("Given another admin, when checking canRevoke, then returns true", async () => {
    const { canRevokeAdmin } = await loadAdminUtils();
    const admin = { email: "other@example.com", role: "tournament-admin" };
    assert.equal(canRevokeAdmin(admin, "me@example.com", 2), true);
  });

  test("Given another super-admin with multiple super-admins, when checking canRevoke, then returns true", async () => {
    const { canRevokeAdmin } = await loadAdminUtils();
    const admin = { email: "other@example.com", role: "super-admin" };
    assert.equal(canRevokeAdmin(admin, "me@example.com", 3), true);
  });
});

describe("canRevokeAdmin — self-revoke prevention", () => {
  test("Given the current admin, when checking canRevoke, then returns false", async () => {
    const { canRevokeAdmin } = await loadAdminUtils();
    const admin = { email: "me@example.com", role: "super-admin" };
    assert.equal(canRevokeAdmin(admin, "me@example.com", 2), false);
  });

  test("Given the current admin as tournament-admin, when checking canRevoke, then returns false", async () => {
    const { canRevokeAdmin } = await loadAdminUtils();
    const admin = { email: "me@example.com", role: "tournament-admin" };
    assert.equal(canRevokeAdmin(admin, "me@example.com", 2), false);
  });
});

describe("canRevokeAdmin — last super-admin protection", () => {
  test("Given the last super-admin, when checking canRevoke, then returns false", async () => {
    const { canRevokeAdmin } = await loadAdminUtils();
    const admin = { email: "other@example.com", role: "super-admin" };
    assert.equal(canRevokeAdmin(admin, "me@example.com", 1), false);
  });

  test("Given a tournament-admin with only one super-admin, when checking canRevoke, then returns true", async () => {
    const { canRevokeAdmin } = await loadAdminUtils();
    const admin = { email: "other@example.com", role: "tournament-admin" };
    assert.equal(canRevokeAdmin(admin, "me@example.com", 1), true);
  });
});

describe("canRevokeAdmin — edge cases", () => {
  test("Given zero super-admins (edge), when checking a super-admin, then returns false", async () => {
    const { canRevokeAdmin } = await loadAdminUtils();
    const admin = { email: "other@example.com", role: "super-admin" };
    assert.equal(canRevokeAdmin(admin, "me@example.com", 0), false);
  });

  test("Given a tournament-admin with zero super-admins, when checking canRevoke, then returns true", async () => {
    const { canRevokeAdmin } = await loadAdminUtils();
    const admin = { email: "other@example.com", role: "tournament-admin" };
    assert.equal(canRevokeAdmin(admin, "me@example.com", 0), true);
  });
});
