const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PAGE_FILE = path.join(
  process.cwd(),
  "src/pages/portal/participant/[pid].js"
);

const src = fs.readFileSync(PAGE_FILE, "utf-8");

describe("Participant page — AdminMenu for admin viewers", () => {
  test("Given the participant page, when checking imports, then AdminMenu is imported", () => {
    assert.match(src, /import\s+AdminMenu\s+from/);
  });

  test("Given an admin viewer, when rendering the page, then AdminMenu is rendered with adminRole prop", () => {
    assert.match(src, /<AdminMenu\s+adminRole=/);
  });
});

describe("Participant page — admin status lookup", () => {
  test("Given the participant page, when checking state, then linkedAdmin state exists", () => {
    assert.match(src, /linkedAdmin/);
  });

  test("Given a super-admin viewer, when the page loads, then it fetches admin lookup by participant email", () => {
    assert.match(src, /\/api\/portal\/admins\/lookup/);
  });
});

describe("Participant page — conditional Make/Revoke admin button", () => {
  test("Given a participant who is already an admin, when rendering buttons, then a Revoke admin button is shown", () => {
    assert.match(src, /Revoke admin/);
  });

  test("Given a participant who is not an admin, when rendering buttons, then the Make admin button is shown", () => {
    assert.match(src, /Make admin/);
  });

  test("Given the page, when checking conditional logic, then linkedAdmin determines which button appears", () => {
    assert.match(src, /linkedAdmin/);
    // Both Make admin and Revoke admin must be present (conditionally rendered)
    assert.match(src, /Make admin/);
    assert.match(src, /Revoke admin/);
  });
});

describe("Participant page — revoke admin modal", () => {
  test("Given a super-admin clicks Revoke admin, when confirming, then a PortalModal is shown", () => {
    assert.match(src, /showRevokeAdmin/);
    assert.match(src, /PortalModal/);
  });

  test("Given the revoke modal, when confirming, then a DELETE request is sent to the admins API", () => {
    assert.match(src, /method:\s*["']DELETE["']/);
    assert.match(src, /\/api\/portal\/admins\//);
  });

  test("Given a successful revoke, when the response is ok, then linkedAdmin is cleared", () => {
    assert.match(src, /setLinkedAdmin\s*\(\s*null\s*\)/);
  });
});
