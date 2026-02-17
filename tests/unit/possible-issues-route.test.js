const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const API_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/admin/possible-issues.js"
);

test("Given possible-issues API file, when checked, then file exists at expected path", () => {
  assert.ok(fs.existsSync(API_PATH), "API route file must exist at src/pages/api/portal/admin/possible-issues.js");
});

test("Given possible-issues API file, when read, then it awaits requireAdmin", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(
    content.includes("await requireAdmin"),
    "possible-issues API must await requireAdmin for admin-only access"
  );
});

test("Given possible-issues API file, when read, then it delegates report generation to possible-issues utility", () => {
  const content = fs.readFileSync(API_PATH, "utf8");
  assert.ok(
    content.includes("buildPossibleIssuesReport"),
    "possible-issues API should use shared report builder from utils for maintainability"
  );
});
