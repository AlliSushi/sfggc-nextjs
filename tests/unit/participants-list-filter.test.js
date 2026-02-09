const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PARTICIPANTS_API = path.join(
  process.cwd(),
  "src/pages/api/portal/participants/index.js"
);

describe("participants list admin filtering", () => {
  test("Given participants API, when building query, then admin-linked participants are filtered out", () => {
    const src = fs.readFileSync(PARTICIPANTS_API, "utf-8");

    // Should have a buildParticipantsQuery function that includes admin filtering
    assert.match(src, /buildParticipantsQuery/i, "Should have buildParticipantsQuery function");

    // Should join with admins table
    assert.match(src, /left join admins a on p\.pid = a\.pid/i);

    // Should filter where admin pid is null in base query
    assert.match(src, /where a\.pid is null/i);
  });

  test("Given buildParticipantsQuery function, when search is provided, then admin filter is preserved", () => {
    const src = fs.readFileSync(PARTICIPANTS_API, "utf-8");

    // The function should use the baseQuery which includes admin filtering
    const functionBody = src.match(/const buildParticipantsQuery[\s\S]*?^};/m);
    assert.ok(functionBody, "buildParticipantsQuery function should exist");

    // Base query should have admin filtering
    assert.match(functionBody[0], /where a\.pid is null/i);

    // Search branch should use baseQuery with additional search conditions
    assert.match(functionBody[0], /if \(search\)/i);
    assert.match(functionBody[0], /and \(lower\(p\.pid\) like \?/i);
  });

  test("Given participants API queries, when filtering admins, then search conditions are combined with AND", () => {
    const src = fs.readFileSync(PARTICIPANTS_API, "utf-8");

    // In search query, admin filter should be combined with search conditions
    const functionBody = src.match(/const buildParticipantsQuery[\s\S]*?^};/m);
    assert.ok(functionBody, "buildParticipantsQuery function should exist");

    // Should have: where a.pid is null AND (search conditions)
    assert.match(functionBody[0], /where a\.pid is null/i);
    assert.match(functionBody[0], /and \(lower\(p\.pid\) like \?/i);
    assert.match(functionBody[0], /lower\(p\.email\) like \?/i);
  });

  test("Given participants API queries, when selecting columns, then table aliases are used", () => {
    const src = fs.readFileSync(PARTICIPANTS_API, "utf-8");

    // Should use p.pid, p.first_name, etc. to avoid ambiguity
    assert.match(src, /select p\.pid, p\.first_name, p\.last_name, p\.nickname, p\.email/i);

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
