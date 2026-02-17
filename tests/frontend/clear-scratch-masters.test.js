const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROUTE_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/admin/scratch-masters/clear.js"
);
const PAGE_PATH = path.join(
  process.cwd(),
  "src/pages/portal/admin/scratch-masters.js"
);

const readRoute = () => fs.readFileSync(ROUTE_PATH, "utf8");
const readPage = () => fs.readFileSync(PAGE_PATH, "utf8");

test("Given clear-scratch-masters API route, when checked, then file exists at expected path", () => {
  assert.ok(
    fs.existsSync(ROUTE_PATH),
    "API route must exist at src/pages/api/portal/admin/scratch-masters/clear.js"
  );
});

test("Given clear-scratch-masters API route, when read, then uses shared super-admin clear helper", () => {
  const content = readRoute();
  assert.ok(content.includes("handleSuperAdminClear"));
});

test("Given clear-scratch-masters API route, when read, then it resets people scratch_masters flag", () => {
  const content = readRoute();
  assert.ok(content.toLowerCase().includes("update people set scratch_masters = 0"));
});

test("Given clear-scratch-masters API route, when read, then it logs clear_scratch_masters admin action", () => {
  const content = readRoute();
  assert.ok(content.includes("clear_scratch_masters"));
});

test("Given scratch masters page, when read, then it contains a Clear Scratch Masters button", () => {
  const content = readPage();
  assert.ok(content.includes("Clear Scratch Masters"));
});

test("Given scratch masters page, when read, then clear action calls clear API endpoint", () => {
  const content = readPage();
  assert.ok(content.includes("/api/portal/admin/scratch-masters/clear"));
});

test("Given scratch masters page, when read, then clear action shows a PortalModal confirmation", () => {
  const content = readPage();
  assert.ok(content.includes("PortalModal"));
  assert.ok(content.includes("Yes, clear scratch masters"));
});

test("Given scratch masters page, when clear completes, then standings are refreshed", () => {
  const content = readPage();
  assert.ok(
    content.includes("loadScratchMasters") || content.includes("setRefreshKey"),
    "Scratch masters page must refetch standings after clear"
  );
});
