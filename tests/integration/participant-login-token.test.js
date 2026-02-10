const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createApiServer } = require("../helpers/api-server");
const { initTestDb } = require("../helpers/test-db");

let db;
let dbReady = false;
let dbSkipReason = "";

if (!process.env.ADMIN_SESSION_SECRET) {
  process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";
}

const loadHandler = async (relativePath) => {
  const fullPath = path.join(process.cwd(), relativePath);
  const module = await import(pathToFileURL(fullPath));
  return module.default;
};

const loadSessionUtils = async () => {
  const fullPath = path.join(process.cwd(), "src/utils/portal/session.js");
  const module = await import(pathToFileURL(fullPath));
  return module;
};

const buildAdminCookie = async ({
  email = "admin@example.com",
  role = "super-admin",
} = {}) => {
  const { buildSessionToken, ADMIN_SESSION_TTL_MS } = await loadSessionUtils();
  const token = buildSessionToken({ email, role }, ADMIN_SESSION_TTL_MS);
  return `portal_admin=${token}`;
};

const seedParticipant = async ({ pid, firstName, lastName, email, teamId, did }) => {
  await db.pool.query(
    `
    insert into people (
      pid, first_name, last_name, email, phone, birth_month, birth_day,
      city, region, country, tnmt_id, did, updated_at
    )
    values (?,?,?,?,?,?,?,?,?,?,?, ?, now())
    `,
    [
      pid,
      firstName,
      lastName,
      email,
      "555-555-5555",
      1,
      1,
      "San Francisco",
      "CA",
      "US",
      teamId,
      did,
    ]
  );
};

before(async () => {
  try {
    db = await initTestDb();
    dbReady = true;
  } catch (error) {
    dbReady = false;
    dbSkipReason = error.message;
  }
});

beforeEach(async () => {
  if (!dbReady) return;
  await db.reset();
});

after(async () => {
  if (!dbReady) return;
  await db.close();
});

/* ------------------------------------------------------------------ */
/*  Participant login token exposure tests                            */
/* ------------------------------------------------------------------ */

test(
  "Given an admin session, when requesting participant login, then the token is included in the response",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    await db.pool.query("insert into teams (tnmt_id, team_name) values (?,?)", [
      "2305",
      "Well, No Split!",
    ]);
    await seedParticipant({
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
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    await db.pool.query("insert into teams (tnmt_id, team_name) values (?,?)", [
      "2305",
      "Well, No Split!",
    ]);
    await seedParticipant({
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
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    await db.pool.query("insert into teams (tnmt_id, team_name) values (?,?)", [
      "2305",
      "Well, No Split!",
    ]);
    await seedParticipant({
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
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }

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
