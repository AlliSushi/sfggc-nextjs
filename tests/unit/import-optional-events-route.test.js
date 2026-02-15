const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const API_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/admin/optional-events/import.js"
);

test("Given optional-events import API file, when checked, then file exists", () => {
  assert.ok(
    fs.existsSync(API_PATH),
    "API route file must exist at src/pages/api/portal/admin/optional-events/import.js"
  );
});

test("Given optional-events import API file, when read, then it uses shared admin CSV import helper", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(content.includes("handleAdminCsvImport"));
  assert.ok(content.includes("parseCsvTextBody"));
  assert.ok(content.includes("IMPORT_MODES"));
});

test("Given optional-events import API file, when read, then it uses optional-events CSV matching utility", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(content.includes("matchOptionalEventsParticipants"));
  assert.ok(content.includes("validateColumns"));
});

test("Given optional-events import API file, when import mode runs, then updates are wrapped in withTransaction and audited", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(content.includes("withTransaction"));
  assert.ok(content.includes("logAdminAction"));
  assert.ok(content.includes("import_optional_events"));
  assert.ok(
    content.includes("No participants matched. Nothing to import."),
    "Route should block import when preview has zero matched participants"
  );
});
