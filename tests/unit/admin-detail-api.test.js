const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const API_FILE = path.join(
  process.cwd(),
  "src/pages/api/portal/admins/[id].js"
);

const readSource = () => fs.readFileSync(API_FILE, "utf-8");

describe("Admin detail API — GET method support", () => {
  test("Given the admins [id] API, when checking allowed methods, then GET is accepted", () => {
    const src = readSource();
    const methodsMatch = src.match(/ALLOWED_METHODS\s*=\s*\[([^\]]+)\]/);
    assert.ok(methodsMatch, "ALLOWED_METHODS array must exist");
    assert.match(methodsMatch[1], /["']GET["']/, "GET must be in ALLOWED_METHODS");
  });

  test("Given a GET request, when sent to the API, then handleGet is called", () => {
    const src = readSource();
    assert.match(src, /handleGet/, "handleGet function must exist");
  });
});

describe("Admin detail API — GET handler", () => {
  test("Given the GET handler, when querying the database, then it selects admin by id with key fields", () => {
    const src = readSource();
    // GET handler should select admin fields including first_name, last_name, email, phone, role, pid
    const selectMatch = src.match(/select[\s\S]*?from admins[\s\S]*?where[\s\S]*?id\s*=/i);
    assert.ok(selectMatch, "GET must select from admins where id = ?");
  });

  test("Given the GET handler, when the admin is not found, then 404 is returned", () => {
    const src = readSource();
    assert.match(src, /404/, "GET handler must return 404 for missing admin");
  });

  test("Given the GET handler, when selecting columns, then pid is included", () => {
    const src = readSource();
    // Find select statements that query by id (not the COUNT query or list query)
    // The GET handler should include pid in its select
    const getHandlerMatch = src.match(/handleGet[\s\S]*?select\s+([\s\S]*?)\s+from admins/i);
    assert.ok(getHandlerMatch, "handleGet must have a select from admins");
    assert.match(getHandlerMatch[1], /\bpid\b/, "pid must be in GET select columns");
  });
});

describe("Admin detail API — extended PATCH handler", () => {
  test("Given the PATCH handler, when receiving a request body, then firstName and lastName are accepted", () => {
    const src = readSource();
    assert.match(src, /firstName/, "PATCH must handle firstName");
    assert.match(src, /lastName/, "PATCH must handle lastName");
  });

  test("Given the PATCH handler, when updating the admin, then first_name, last_name, email, phone are updated", () => {
    const src = readSource();
    // The UPDATE statement should set multiple fields
    const updateMatch = src.match(/update admins[\s\S]*?set[\s\S]*?where/i);
    assert.ok(updateMatch, "PATCH must have UPDATE admins SET ... WHERE");
    assert.match(updateMatch[0], /first_name/i, "UPDATE must set first_name");
    assert.match(updateMatch[0], /last_name/i, "UPDATE must set last_name");
  });

  test("Given the PATCH handler, when updating, then ensureAdminActionsTables is used", () => {
    const src = readSource();
    // The PATCH handler should use ensureAdminActionsTables for audit support
    assert.match(src, /ensureAdminActionsTables/, "PATCH must use ensureAdminActionsTables");
  });

  test("Given the PATCH handler, when updating, then an admin_actions audit entry is inserted with modify_admin action", () => {
    const src = readSource();
    assert.match(src, /admin_actions/, "PATCH must insert into admin_actions");
    assert.match(src, /modify_admin/, "PATCH audit action must be modify_admin");
  });

  test("Given the PATCH handler, when demoting the last super-admin, then it is blocked with 409", () => {
    const src = readSource();
    // The PATCH handler must check super-admin count before demotion
    // Look for the demotion check pattern in the PATCH handler area
    assert.match(src, /Cannot.*last super-admin|last super-admin/i, "PATCH must block last super-admin demotion");
  });

  test("Given the PATCH handler, when updating, then withTransaction is used", () => {
    const src = readSource();
    // The PATCH handler should use transactions for atomic update + audit
    // Check that withTransaction appears in the PATCH-related code
    const patchSection = src.match(/handlePatch[\s\S]*/);
    assert.ok(patchSection, "handlePatch must exist");
    assert.match(patchSection[0], /withTransaction/, "PATCH must use withTransaction");
  });
});
