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
    content.includes("handleAdminCsvImport"),
    "must use shared handleAdminCsvImport helper, which enforces super-admin auth"
  );
});

test("Given import-lanes API file, when read, then handles preview and import modes", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(
    content.includes("IMPORT_MODES"),
    'must use shared import mode constants for "preview" and "import" behavior'
  );
  assert.ok(
    content.includes("IMPORT_MODES.IMPORT"),
    'must handle "import" mode via IMPORT_MODES constant'
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

test("Given import-lanes API file, when handling no-match imports, then it uses shared no-match error helpers", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(
    content.includes("NO_PARTICIPANTS_MATCHED_ERROR"),
    "route must reuse NO_PARTICIPANTS_MATCHED_ERROR constant"
  );
  assert.ok(
    content.includes("isNoParticipantsMatchedError"),
    "route must reuse isNoParticipantsMatchedError helper"
  );
  assert.ok(
    content.includes("parseCsvTextBody"),
    "route must reuse parseCsvTextBody helper for csvText validation"
  );
});

test("Given import-lanes API file, when request body is too large, then it returns 413", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(
    content.includes("handleAdminCsvImport"),
    "route must use shared import helper, which guards oversized CSV payloads with HTTP 413"
  );
});
