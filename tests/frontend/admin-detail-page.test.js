const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PAGE_FILE = path.join(
  process.cwd(),
  "src/pages/portal/admin/admins/[id].js"
);

const readSource = () => fs.readFileSync(PAGE_FILE, "utf-8");

describe("Admin detail page — file exists", () => {
  test("Given the admin detail route, when checking the filesystem, then [id].js exists", () => {
    assert.ok(fs.existsSync(PAGE_FILE), "Admin detail page file must exist");
  });
});

describe("Admin detail page — imports", () => {
  test("Given the admin detail page, when checking imports, then PortalShell is imported", () => {
    const src = readSource();
    assert.match(src, /PortalShell/);
  });

  test("Given the admin detail page, when checking imports, then PortalModal is imported", () => {
    const src = readSource();
    assert.match(src, /PortalModal/);
  });

  test("Given the admin detail page, when checking imports, then Link is imported from next/link", () => {
    const src = readSource();
    assert.match(src, /import\s+Link\s+from\s+["']next\/link["']/);
  });

  test("Given the admin detail page, when checking imports, then portalFetch is imported", () => {
    const src = readSource();
    assert.match(src, /portalFetch/);
  });

  test("Given the admin detail page, when checking imports, then canRevokeAdmin is imported", () => {
    const src = readSource();
    assert.match(src, /canRevokeAdmin/);
  });
});

describe("Admin detail page — SSR", () => {
  test("Given the admin detail page, when checking SSR, then getServerSideProps is exported", () => {
    const src = readSource();
    assert.match(src, /getServerSideProps/);
  });

  test("Given the admin detail page, when checking SSR, then requireSuperAdminSSR is used", () => {
    const src = readSource();
    assert.match(src, /requireSuperAdminSSR/);
  });
});

describe("Admin detail page — view mode", () => {
  test("Given the admin detail page, when displaying admin info, then email, phone, and role are shown", () => {
    const src = readSource();
    assert.match(src, /email/, "Page must display email");
    assert.match(src, /phone/, "Page must display phone");
    assert.match(src, /role/, "Page must display role");
  });

  test("Given an admin with a pid, when viewing the detail page, then pid links to /portal/participant/", () => {
    const src = readSource();
    assert.match(src, /\/portal\/participant\//);
  });
});

describe("Admin detail page — edit mode", () => {
  test("Given the admin detail page, when clicking Modify, then form inputs for name, email, phone, role are shown", () => {
    const src = readSource();
    assert.match(src, /isEditing/, "Page must have isEditing state");
    assert.match(src, /firstName/, "Page must have firstName form field");
    assert.match(src, /lastName/, "Page must have lastName form field");
  });

  test("Given the admin detail page in edit mode, when saving, then PATCH is sent via portalFetch", () => {
    const src = readSource();
    assert.match(src, /PATCH/);
    assert.match(src, /portalFetch/);
  });
});

describe("Admin detail page — revoke", () => {
  test("Given the admin detail page, when checking for revoke, then a Revoke button exists", () => {
    const src = readSource();
    assert.match(src, /Revoke/);
  });

  test("Given the admin detail page, when revoking, then DELETE is sent via portalFetch", () => {
    const src = readSource();
    assert.match(src, /DELETE/);
  });

  test("Given the admin detail page, when revoking, then a confirmation modal is shown with PortalModal", () => {
    const src = readSource();
    assert.match(src, /showRevokeModal/);
    assert.match(src, /PortalModal/);
  });
});

describe("Admin detail page — layout and navigation", () => {
  test("Given the admin detail page, when checking layout, then getLayout with RootLayout is defined", () => {
    const src = readSource();
    assert.match(src, /getLayout/);
    assert.match(src, /RootLayout/);
  });

  test("Given the admin detail page, when navigating, then a back link to /portal/admin/admins exists", () => {
    const src = readSource();
    assert.match(src, /\/portal\/admin\/admins/);
  });
});
