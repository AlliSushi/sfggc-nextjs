const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PARTICIPANTS_API = path.join(
  process.cwd(),
  "src/pages/api/portal/participants/index.js"
);

describe("participants list admin filtering", () => {
  test("Given participants API, when querying with search, then admin-linked participants are filtered out", () => {
    const src = fs.readFileSync(PARTICIPANTS_API, "utf-8");

    // Should join with admins table
    assert.match(src, /left join admins a on p\.pid = a\.pid/i);

    // Should filter where admin pid is null (within search query)
    const searchQuery = src.match(/if \(search\) \{[\s\S]*?const result = await query\([\s\S]*?\);/);
    assert.ok(searchQuery, "Search query block should exist");
    assert.match(searchQuery[0], /where a\.pid is null/i);
  });

  test("Given participants API, when querying without search, then admin-linked participants are filtered out", () => {
    const src = fs.readFileSync(PARTICIPANTS_API, "utf-8");

    // Should join with admins table
    assert.match(src, /left join admins a on p\.pid = a\.pid/i);

    // Should filter where admin pid is null (within default query)
    const defaultQuery = src.match(/else \{[\s\S]*?rows = \([\s\S]*?await query\([\s\S]*?\)[\s\S]*?\)\.rows;/);
    assert.ok(defaultQuery, "Default query block should exist");
    assert.match(defaultQuery[0], /where a\.pid is null/i);
  });

  test("Given participants API queries, when filtering admins, then search conditions are combined with AND", () => {
    const src = fs.readFileSync(PARTICIPANTS_API, "utf-8");

    // In search query, admin filter should be combined with search conditions
    const searchQuery = src.match(/if \(search\) \{[\s\S]*?const result = await query\([\s\S]*?\);/);
    assert.ok(searchQuery, "Search query block should exist");

    // Should have: where a.pid is null AND (search conditions)
    assert.match(searchQuery[0], /where a\.pid is null[\s\S]*?and \(/i);
    assert.match(searchQuery[0], /lower\(p\.pid\) like \?/i);
    assert.match(searchQuery[0], /lower\(p\.email\) like \?/i);
  });

  test("Given participants API queries, when selecting columns, then table aliases are used", () => {
    const src = fs.readFileSync(PARTICIPANTS_API, "utf-8");

    // Should use p.pid, p.first_name, etc. to avoid ambiguity
    assert.match(src, /select p\.pid, p\.first_name, p\.last_name, p\.email/i);

    // Should use t.team_name for joined teams table
    assert.match(src, /t\.team_name/i);
  });

  test("Given participants API queries, when ordering results, then table alias is used", () => {
    const src = fs.readFileSync(PARTICIPANTS_API, "utf-8");

    // Should use p.last_name, p.first_name in ORDER BY
    assert.match(src, /order by p\.last_name, p\.first_name/i);
  });
});

describe("participants API two-table architecture", () => {
  test("Given participants API, when filtering admins, then participants can still be promoted to admins", () => {
    const src = fs.readFileSync(PARTICIPANTS_API, "utf-8");

    // The LEFT JOIN pattern allows participants to exist independently
    // When a participant is promoted to admin, they get a row in admins table
    // The filter (a.pid is null) then hides them from participant list
    // If admin is revoked, the admins row is deleted, making them visible again

    // Should use LEFT JOIN (not INNER JOIN) to allow NULL admins
    assert.match(src, /left join admins a/i);

    // Should filter on a.pid is null (not a.id is null)
    // This links via the pid field in admins table
    assert.match(src, /where a\.pid is null/i);
  });
});
