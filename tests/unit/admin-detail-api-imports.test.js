const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const API_DIR = path.join(
  process.cwd(),
  "src/pages/api/portal/admins/[id]"
);

describe("Admin detail API — module resolution", () => {
  test("Given admins [id]/index.js, when loading the module, then all imports resolve successfully", async () => {
    const mod = await import(path.join(API_DIR, "index.js"));
    assert.ok(mod.default, "Module must have a default export");
    assert.equal(typeof mod.default, "function", "Default export must be a handler function");
  });

  test("Given admins [id]/force-password-change.js, when loading the module, then all imports resolve successfully", async () => {
    const mod = await import(path.join(API_DIR, "force-password-change.js"));
    assert.ok(mod.default, "Module must have a default export");
    assert.equal(typeof mod.default, "function", "Default export must be a handler function");
  });
});
