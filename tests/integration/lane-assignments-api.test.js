const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { createApiServer } = require("../helpers/api-server");
const {
  loadHandler,
  buildAdminCookie,
  setupIntegrationDb,
  requireDb,
} = require("../helpers/integration-helpers");

const dbState = setupIntegrationDb();

test("Given no admin session, when requesting lane assignments, then response is unauthorized", async (t) => {
  if (!requireDb(t, dbState)) return;

  const handler = await loadHandler("src/pages/api/portal/admin/lane-assignments.js");
  const server = await createApiServer(handler);
  const response = await fetch(`${server.url}/api/portal/admin/lane-assignments`);
  await server.close();

  assert.equal(response.status, 401);
});

test("Given lane data for team, doubles, and singles, when requesting lane assignments, then odd-lane matchups are returned", async (t) => {
  const db = requireDb(t, dbState);
  if (!db) return;

  await db.pool.query(
    "insert into admins (id, email, name, role, password_hash) values (?,?,?,?,?)",
    [crypto.randomUUID(), "admin@example.com", "Admin", "tournament-admin", "not-a-real-hash"]
  );

  await db.pool.query("insert into teams (tnmt_id, team_name) values (?,?), (?,?)", [
    "T1",
    "Odd Rollers",
    "T2",
    "Even Rollers",
  ]);

  await db.pool.query(
    `
    insert into people (
      pid, first_name, last_name, nickname, email, phone, birth_month, birth_day,
      city, region, country, tnmt_id, did, updated_at
    )
    values
      (?,?,?,?,?,?,?,?,?,?,?,?,?, now()),
      (?,?,?,?,?,?,?,?,?,?,?,?,?, now()),
      (?,?,?,?,?,?,?,?,?,?,?,?,?, now()),
      (?,?,?,?,?,?,?,?,?,?,?,?,?, now())
    `,
    [
      "P1", "Alex", "Anchor", null, "p1@example.com", "555-000-0001", 1, 1, "SF", "CA", "US", "T1", "DP1",
      "P2", "Blair", "Bridge", null, "p2@example.com", "555-000-0002", 1, 1, "SF", "CA", "US", "T1", "DP2",
      "P3", "Casey", "Clutch", null, "p3@example.com", "555-000-0003", 1, 1, "SF", "CA", "US", "T2", "DP3",
      "P4", "Drew", "Drive", null, "p4@example.com", "555-000-0004", 1, 1, "SF", "CA", "US", "T2", "DP4",
    ]
  );

  await db.pool.query(
    `
    insert into doubles_pairs (did, pid, partner_pid)
    values
      (?,?,?), (?,?,?),
      (?,?,?), (?,?,?)
    `,
    [
      "DP1", "P1", "P2",
      "DP2", "P2", "P1",
      "DP3", "P3", "P4",
      "DP4", "P4", "P3",
    ]
  );

  await db.pool.query(
    `
    insert into scores (id, pid, event_type, lane, game1, game2, game3, updated_at)
    values
      (uuid(), ?, 'team', ?, 200, 200, 200, now()),
      (uuid(), ?, 'team', ?, 180, 180, 180, now()),
      (uuid(), ?, 'doubles', ?, 210, 210, 210, now()),
      (uuid(), ?, 'doubles', ?, 205, 205, 205, now()),
      (uuid(), ?, 'doubles', ?, 204, 204, 204, now()),
      (uuid(), ?, 'doubles', ?, 203, 203, 203, now()),
      (uuid(), ?, 'singles', ?, 190, 190, 190, now()),
      (uuid(), ?, 'singles', ?, 195, 195, 195, now())
    `,
    ["P1", "1", "P3", "2", "P1", "9", "P3", "10", "P2", "9", "P4", "10", "P2", "13", "P4", "14"]
  );

  const handler = await loadHandler("src/pages/api/portal/admin/lane-assignments.js");
  const server = await createApiServer(handler);
  const adminCookie = await buildAdminCookie();
  const response = await fetch(`${server.url}/api/portal/admin/lane-assignments`, {
    headers: { cookie: adminCookie },
  });
  const data = await response.json();
  await server.close();

  assert.equal(response.status, 200);
  assert.deepEqual(data.team, [
    {
      lane: 1,
      leftEntries: [{ label: "Odd Rollers", teamSlug: "odd-rollers" }],
      rightEntries: [{ label: "Even Rollers", teamSlug: "even-rollers" }],
      leftMembers: ["Odd Rollers"],
      rightMembers: ["Even Rollers"],
      left: "Odd Rollers",
      right: "Even Rollers",
    },
  ]);
  assert.deepEqual(data.doubles, [
    {
      lane: 9,
      leftEntries: [
        { label: "Alex Anchor", pid: "P1" },
        { label: "Blair Bridge", pid: "P2" },
      ],
      rightEntries: [
        { label: "Casey Clutch", pid: "P3" },
        { label: "Drew Drive", pid: "P4" },
      ],
      leftMembers: ["Alex Anchor", "Blair Bridge"],
      rightMembers: ["Casey Clutch", "Drew Drive"],
      left: "Alex Anchor, Blair Bridge",
      right: "Casey Clutch, Drew Drive",
    },
  ]);
  assert.deepEqual(data.singles, [
    {
      lane: 13,
      leftEntries: [{ label: "Blair Bridge", pid: "P2" }],
      rightEntries: [{ label: "Drew Drive", pid: "P4" }],
      leftMembers: ["Blair Bridge"],
      rightMembers: ["Drew Drive"],
      left: "Blair Bridge",
      right: "Drew Drive",
    },
  ]);
});
