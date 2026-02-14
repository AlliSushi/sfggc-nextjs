const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const API_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/admin/import-lanes.js"
);

test("Given import-lanes API file, when checked, then file exists at expected path", () => {
  assert.ok(fs.existsSync(API_PATH), "API route file must exist at src/pages/api/portal/admin/import-lanes.js");
});

test("Given import-lanes API file, when read, then exports a default function handler", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  const hasExport =
    content.includes("export default") || content.includes("module.exports");
  assert.ok(hasExport, "must export a default handler via export default or module.exports");
});

test("Given import-lanes API file, when read, then uses await with requireSuperAdmin", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(
    content.includes("await requireSuperAdmin"),
    "must use await requireSuperAdmin — missing await bypasses auth entirely"
  );
});

test("Given import-lanes API file, when read, then handles preview and import modes", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(
    content.includes('"preview"'),
    'must handle "preview" mode'
  );
  assert.ok(
    content.includes('"import"'),
    'must handle "import" mode'
  );
});

test("Given import-lanes API file, when read, then imports from importLanesCsv", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(
    content.includes("matchParticipants") && content.includes("importLanes"),
    "must import lane assignment parsing helpers from importLanesCsv utility"
  );
});

test("Given import-lanes API file, when processing import mode, then withTransaction is used", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(
    content.includes("withTransaction"),
    "import mode must use withTransaction to avoid partial updates"
  );
});

test("Given import-lanes API file, when request body is too large, then it returns 413", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(
    content.includes("413") && content.includes("CSV too large"),
    "route must guard oversized CSV payloads with HTTP 413"
  );
});
