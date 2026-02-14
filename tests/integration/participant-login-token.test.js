const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createApiServer } = require("../helpers/api-server");
const {
  loadHandler,
  loadSessionUtils,
  buildAdminCookie,
  seedDefaultAdmin,
  seedParticipant,
  setupIntegrationDb,
  requireDb,
} = require("../helpers/integration-helpers");

const dbState = setupIntegrationDb();

/* ------------------------------------------------------------------ */
/*  Participant login token exposure tests                            */
/* ------------------------------------------------------------------ */

test(
  "Given an admin session, when requesting participant login, then the token is included in the response",
  async (t) => {
    const db = requireDb(t, dbState);
    if (!db) return;
    await seedDefaultAdmin(db.pool);
    await db.pool.query("insert into teams (tnmt_id, team_name) values (?,?)", [
      "2305",
      "Well, No Split!",
    ]);
    await seedParticipant(db.pool, {
      pid: "3336",
      firstName: "Robert",
      lastName: "Aldeguer",
      email: "robert@example.com",
      teamId: "2305",
      did: "1076",
    });

    const handler = await loadHandler("src/pages/api/portal/participant/login.js");
    const server = await createApiServer(handler);
    const adminCookie = await buildAdminCookie();
    const response = await fetch(`${server.url}/api/portal/participant/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookie,
      },
      body: JSON.stringify({ email: "robert@example.com" }),
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.ok(data.token, "Token must be present when admin session is active");
    assert.equal(typeof data.token, "string");
    assert.ok(data.token.length > 0);
  }
);

test(
  "Given no admin session, when requesting participant login, then the token is not included in the response",
  async (t) => {
    const db = requireDb(t, dbState);
    if (!db) return;
    await db.pool.query("insert into teams (tnmt_id, team_name) values (?,?)", [
      "2305",
      "Well, No Split!",
    ]);
    await seedParticipant(db.pool, {
      pid: "3336",
      firstName: "Robert",
      lastName: "Aldeguer",
      email: "robert@example.com",
      teamId: "2305",
      did: "1076",
    });

    const handler = await loadHandler("src/pages/api/portal/participant/login.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/participant/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "robert@example.com" }),
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.token, undefined, "Token must not be exposed to non-admin callers");
  }
);

test(
  "Given an expired admin session, when requesting participant login, then the token is not included",
  async (t) => {
    const db = requireDb(t, dbState);
    if (!db) return;
    await db.pool.query("insert into teams (tnmt_id, team_name) values (?,?)", [
      "2305",
      "Well, No Split!",
    ]);
    await seedParticipant(db.pool, {
      pid: "3336",
      firstName: "Robert",
      lastName: "Aldeguer",
      email: "robert@example.com",
      teamId: "2305",
      did: "1076",
    });

    const { buildSessionToken } = await loadSessionUtils();
    const expiredToken = buildSessionToken(
      { email: "admin@example.com", role: "super-admin" },
      -1000
    );
    const expiredCookie = `portal_admin=${expiredToken}`;

    const handler = await loadHandler("src/pages/api/portal/participant/login.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/participant/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: expiredCookie,
      },
      body: JSON.stringify({ email: "robert@example.com" }),
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.token, undefined, "Token must not be exposed when admin session is expired");
  }
);

test(
  "Given no matching participant, when requesting login with admin session, then ok true and no token",
  async (t) => {
    const db = requireDb(t, dbState);
    if (!db) return;
    await seedDefaultAdmin(db.pool);

    const handler = await loadHandler("src/pages/api/portal/participant/login.js");
    const server = await createApiServer(handler);
    const adminCookie = await buildAdminCookie();
    const response = await fetch(`${server.url}/api/portal/participant/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookie,
      },
      body: JSON.stringify({ email: "nonexistent@example.com" }),
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.token, undefined, "No token when participant not found");
  }
);
