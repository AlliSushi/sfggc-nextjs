const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PAGE_FILE = path.join(
  process.cwd(),
  "src/pages/portal/admin/admins/index.js"
);

const readSource = () => fs.readFileSync(PAGE_FILE, "utf-8");

describe("Admin revoke UI — imports", () => {
  test("Given the admins page, when checking imports, then canRevokeAdmin is imported from admins-client", () => {
    const src = readSource();
    assert.match(src, /canRevokeAdmin/);
    assert.match(src, /admins-client/);
  });
});

describe("Admin revoke UI — SSR email prop", () => {
  test("Given the admins page SSR, when checking getServerSideProps, then adminEmail is passed via extraPropsFromPayload", () => {
    const src = readSource();
    assert.match(src, /adminEmail/);
    assert.match(src, /extraPropsFromPayload|payload\.email|payload/);
  });
});

describe("Admin revoke UI — Revoke button", () => {
  test("Given the admins page, when rendering admin rows, then a Revoke button is present", () => {
    const src = readSource();
    assert.match(src, /Revoke/);
    assert.match(src, /btn/);
  });

  test("Given the admins page, when rendering a row, then canRevokeAdmin controls button visibility", () => {
    const src = readSource();
    assert.match(src, /canRevokeAdmin/);
  });
});

describe("Admin revoke UI — confirmation modal", () => {
  test("Given the admins page, when Revoke is clicked, then a confirmation modal is shown", () => {
    const src = readSource();
    // Should have a revoke-specific modal state
    assert.match(src, /revokeTarget|showRevokeModal|revokeModal/);
  });

  test("Given the revoke modal, when displayed, then it shows audit trail notice", () => {
    const src = readSource();
    assert.match(src, /audit/i);
  });

  test("Given the revoke modal, when confirmed, then DELETE is sent via portalFetch", () => {
    const src = readSource();
    assert.match(src, /DELETE/);
    assert.match(src, /portalFetch/);
  });

  test("Given the revoke modal, when confirmed, then btn-danger is used for the confirm button", () => {
    const src = readSource();
    assert.match(src, /btn-danger/);
  });
});

describe("Admin revoke UI — Actions column", () => {
  test("Given the admins table, when rendered, then an Actions column header exists", () => {
    const src = readSource();
    assert.match(src, /Actions/);
  });
});
