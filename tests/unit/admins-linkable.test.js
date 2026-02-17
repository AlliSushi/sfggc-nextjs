const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const API_FILE = path.join(
  process.cwd(),
  "src/pages/api/portal/admins/index.js"
);
const PAGE_FILE = path.join(
  process.cwd(),
  "src/pages/portal/admin/admins/index.js"
);

describe("Admins API — pid in GET response", () => {
  test("Given the admins GET query, when selecting columns, then pid is included in the select list", () => {
    const src = fs.readFileSync(API_FILE, "utf-8");
    const getSelectMatch = src.match(/select\s+([\s\S]*?)\s+from admins\s+order by/i);
    assert.ok(getSelectMatch, "GET select statement must exist");
    const columns = getSelectMatch[1];
    assert.match(columns, /\bpid\b/, "pid must be in the GET select column list");
  });
});

describe("Admins page — Link import", () => {
  test("Given the admins page, when checking imports, then Link is imported from next/link", () => {
    const src = fs.readFileSync(PAGE_FILE, "utf-8");
    assert.match(src, /import\s+Link\s+from\s+["']next\/link["']/);
  });
});

describe("Admins page — linkable name and email to admin detail page", () => {
  test("Given an admin row, when rendering the name cell, then a Link to /portal/admin/admins/ is rendered", () => {
    const src = fs.readFileSync(PAGE_FILE, "utf-8");
    assert.match(src, /\/portal\/admin\/admins\//);
    assert.match(src, /Link/);
  });

  test("Given an admin row, when rendering name and email cells, then at least two Links to admin detail pages exist", () => {
    const src = fs.readFileSync(PAGE_FILE, "utf-8");
    const linkMatches = src.match(/<Link[\s\S]*?\/portal\/admin\/admins\//g);
    assert.ok(linkMatches && linkMatches.length >= 2, "Expected at least 2 Links to admin detail pages (name + email)");
  });

  test("Given an admin row, when rendering links, then admin.id is used in the href", () => {
    const src = fs.readFileSync(PAGE_FILE, "utf-8");
    assert.match(src, /admin\.id/, "Links must use admin.id in href");
  });
});
