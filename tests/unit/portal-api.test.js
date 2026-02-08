const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const bcrypt = require("bcryptjs");
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

const parseCookie = (cookieHeader) => cookieHeader?.split(";")[0] || "";

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

const seedTeamMember = async ({
  pid,
  firstName,
  lastName,
  email,
  teamId,
  did,
  teamCaptain,
  teamOrder,
  city = "San Francisco",
  region = "CA",
  country = "US",
}) => {
  await db.pool.query(
    `
    insert into people (
      pid, first_name, last_name, email, phone, birth_month, birth_day,
      city, region, country, tnmt_id, did, team_captain, team_order, updated_at
    )
    values (?,?,?,?,?,?,?,?,?,?,?,?,?, ?, now())
    `,
    [
      pid,
      firstName,
      lastName,
      email,
      "555-555-5555",
      1,
      1,
      city,
      region,
      country,
      teamId,
      did,
      teamCaptain,
      teamOrder,
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

test("Given participants exist, when searching, then results match query", async (t) => {
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
  await seedParticipant({
    pid: "1076",
    firstName: "Dan",
    lastName: "Fahy",
    email: "dan@example.com",
    teamId: "2305",
    did: "3336",
  });

  const handler = await loadHandler("src/pages/api/portal/participants/index.js");
  const server = await createApiServer(handler);
  const adminCookie = await buildAdminCookie();
  const response = await fetch(`${server.url}/api/portal/participants?search=aldeguer`, {
    headers: { cookie: adminCookie },
  });
  const data = await response.json();
  await server.close();

  assert.equal(response.status, 200);
  assert.equal(data.length, 1);
  assert.equal(data[0].pid, "3336");
});

test("Given a participant with doubles pairing, when fetching details, then partner data resolves", async (t) => {
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
  await seedParticipant({
    pid: "1076",
    firstName: "Dan",
    lastName: "Fahy",
    email: "dan@example.com",
    teamId: "2305",
    did: "3336",
  });
  await db.pool.query(
    `
    insert into doubles_pairs (did, pid, partner_pid, partner_first_name, partner_last_name)
    values (?,?,?,?,?)
    `,
    ["1076", "3336", "1076", "Dan", "Fahy"]
  );

  const handler = await loadHandler("src/pages/api/portal/participants/[pid].js");
  const handlerWithPid = (req, res) => {
    const match = req.url.match(/participants\/([^/?]+)/);
    req.query = { ...(req.query || {}), pid: match?.[1] };
    return handler(req, res);
  };
  const server = await createApiServer(handlerWithPid);
  const adminCookie = await buildAdminCookie();
  const response = await fetch(
    `${server.url}/api/portal/participants/3336`,
    {
      headers: { cookie: adminCookie },
    }
  );
  const data = await response.json();
  await server.close();

  assert.equal(response.status, 200);
  assert.equal(data.doubles.partnerPid, "1076");
  assert.equal(data.doubles.partnerName, "Dan Fahy");
});

test("Given valid admin credentials, when logging in, then session cookie is set", async (t) => {
  if (!dbReady) {
    t.skip(dbSkipReason || "Database not available");
    return;
  }
  const passwordHash = bcrypt.hashSync("test-password", 10);
  await db.pool.query(
    "insert into admins (id, email, name, role, password_hash) values (?,?,?,?,?)",
    [crypto.randomUUID(), "admin@example.com", "Admin", "super-admin", passwordHash]
  );

  const handler = await loadHandler("src/pages/api/portal/admin/login.js");
  const server = await createApiServer(handler);
  const response = await fetch(`${server.url}/api/portal/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "test-password" }),
  });
  const data = await response.json();
  const setCookie = response.headers.get("set-cookie");
  await server.close();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(setCookie?.includes("portal_admin="));
});

test(
  "Given a valid session, when refreshing, then a new token is issued with 6h TTL",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    const passwordHash = bcrypt.hashSync("test-password", 10);
    await db.pool.query(
      "insert into admins (id, email, name, role, password_hash) values (?,?,?,?,?)",
      [crypto.randomUUID(), "admin@example.com", "Admin", "super-admin", passwordHash]
    );

    const loginHandler = await loadHandler("src/pages/api/portal/admin/login.js");
    const loginServer = await createApiServer(loginHandler);
    const loginResponse = await fetch(`${loginServer.url}/api/portal/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "test-password" }),
    });
    const loginCookie = parseCookie(loginResponse.headers.get("set-cookie"));
    await loginServer.close();

    const refreshHandler = await loadHandler("src/pages/api/portal/admin/refresh.js");
    const refreshServer = await createApiServer(refreshHandler);
    const refreshResponse = await fetch(`${refreshServer.url}/api/portal/admin/refresh`, {
      headers: {
        cookie: loginCookie,
      },
    });
    const refreshCookie = parseCookie(refreshResponse.headers.get("set-cookie"));
    await refreshServer.close();

    const { verifyToken } = await loadSessionUtils();
    const tokenValue = refreshCookie.split("=")[1];
    const payload = verifyToken(tokenValue);

    assert.equal(refreshResponse.status, 204);
    assert.ok(payload?.exp);
    const ttlMs = payload.exp - Date.now();
    assert.ok(ttlMs > 5.5 * 60 * 60 * 1000);
    assert.ok(ttlMs <= 6 * 60 * 60 * 1000);
  }
);

test("Given a valid session cookie, when checking session, then ok true", async (t) => {
  if (!dbReady) {
    t.skip(dbSkipReason || "Database not available");
    return;
  }
  const passwordHash = bcrypt.hashSync("test-password", 10);
  await db.pool.query(
    "insert into admins (id, email, name, role, password_hash) values (?,?,?,?,?)",
    [crypto.randomUUID(), "admin@example.com", "Admin", "super-admin", passwordHash]
  );

  const loginHandler = await loadHandler("src/pages/api/portal/admin/login.js");
  const loginServer = await createApiServer(loginHandler);
  const loginResponse = await fetch(`${loginServer.url}/api/portal/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "test-password" }),
  });
  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
  await loginServer.close();

  const sessionHandler = await loadHandler("src/pages/api/portal/admin/session.js");
  const sessionServer = await createApiServer(sessionHandler);
  const sessionResponse = await fetch(`${sessionServer.url}/api/portal/admin/session`, {
    headers: {
      cookie,
    },
  });
  const sessionData = await sessionResponse.json();
  await sessionServer.close();

  assert.equal(sessionResponse.status, 200);
  assert.equal(sessionData.ok, true);
  assert.equal(sessionData.admin.email, "admin@example.com");
});

test("Given an expired session token, when checking session, then ok false", async (t) => {
  if (!dbReady) {
    t.skip(dbSkipReason || "Database not available");
    return;
  }
  const { buildSessionToken } = await loadSessionUtils();
  const expiredToken = buildSessionToken(
    { email: "admin@example.com", role: "super-admin" },
    -1000
  );

  const sessionHandler = await loadHandler("src/pages/api/portal/admin/session.js");
  const sessionServer = await createApiServer(sessionHandler);
  const sessionResponse = await fetch(`${sessionServer.url}/api/portal/admin/session`, {
    headers: {
      cookie: `portal_admin=${expiredToken}`,
    },
  });
  const sessionData = await sessionResponse.json();
  await sessionServer.close();

  assert.equal(sessionResponse.status, 401);
  assert.equal(sessionData.ok, false);
});

test(
  "Given a tournament admin, when requesting audit log, then access is denied",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    const { buildSessionToken } = await loadSessionUtils();
    const token = buildSessionToken({ email: "ta@example.com", role: "tournament-admin" });

    const handler = await loadHandler("src/pages/api/portal/admin/audit.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admin/audit`, {
      headers: {
        cookie: `portal_admin=${token}`,
      },
    });
    await server.close();

    assert.equal(response.status, 403);
  }
);

test(
  "Given a super admin, when requesting audit log, then entries are returned",
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
    await db.pool.query(
      `
      insert into audit_logs (id, admin_email, pid, field, old_value, new_value)
      values (?,?,?,?,?,?)
      `,
      [crypto.randomUUID(), "admin@example.com", "3336", "email", "old@example.com", "new@example.com"]
    );

    const { buildSessionToken } = await loadSessionUtils();
    const token = buildSessionToken({ email: "admin@example.com", role: "super-admin" });

    const handler = await loadHandler("src/pages/api/portal/admin/audit.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admin/audit`, {
      headers: {
        cookie: `portal_admin=${token}`,
      },
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 1);
  }
);

test(
  "Given a super admin, when listing admins, then the admin list is returned",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    await db.pool.query(
      "insert into admins (id, email, name, role, password_hash) values (?,?,?,?,?)",
      [crypto.randomUUID(), "admin@example.com", "Admin", "super-admin", "hash"]
    );

    const { buildSessionToken } = await loadSessionUtils();
    const token = buildSessionToken({ email: "admin@example.com", role: "super-admin" });

    const handler = await loadHandler("src/pages/api/portal/admins/index.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admins`, {
      headers: {
        cookie: `portal_admin=${token}`,
      },
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.find((admin) => admin.email === "admin@example.com"));
  }
);

test(
  "Given a super admin, when creating an admin with email, then the account is created and reset token issued",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    const { buildSessionToken } = await loadSessionUtils();
    const token = buildSessionToken({ email: "admin@example.com", role: "super-admin" });

    const handler = await loadHandler("src/pages/api/portal/admins/index.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `portal_admin=${token}`,
      },
      body: JSON.stringify({
        firstName: "Test",
        lastName: "Admin",
        email: "newadmin@example.com",
        role: "tournament-admin",
        initialPassword: "StrongPass1234",
      }),
    });
    const data = await response.json();
    await server.close();

    const { rows } = await db.pool.query(
      "select cast(count(*) as signed) as count from admin_password_resets"
    );

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(rows[0].count, 1);
  }
);

test(
  "Given an admin with a reset token, when logging in, then they are forced to reset password",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    const passwordHash = bcrypt.hashSync("test-password", 10);
    await db.pool.query(
      "insert into admins (id, email, name, role, password_hash) values (?,?,?,?,?)",
      [crypto.randomUUID(), "admin@example.com", "Admin", "tournament-admin", passwordHash]
    );
    await db.pool.query(
      `
      insert into admin_password_resets (admin_id, token, expires_at)
      select id, ?, date_add(now(), interval 1 hour)
      from admins where email = ?
      `,
      ["reset-token", "admin@example.com"]
    );

    const handler = await loadHandler("src/pages/api/portal/admin/login.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "test-password" }),
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.equal(data.needsReset, true);
  }
);

test(
  "Given a reset token, when submitting a strong password twice, then password is updated and session starts",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    await db.pool.query(
      "insert into admins (id, email, name, role, password_hash) values (?,?,?,?,?)",
      [crypto.randomUUID(), "admin@example.com", "Admin", "tournament-admin", "hash"]
    );
    await db.pool.query(
      `
      insert into admin_password_resets (admin_id, token, expires_at)
      select id, ?, date_add(now(), interval 1 hour)
      from admins where email = ?
      `,
      ["reset-token", "admin@example.com"]
    );

    const handler = await loadHandler("src/pages/api/portal/admin/reset-password.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admin/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: "portal_admin_reset=reset-token" },
      body: JSON.stringify({
        password: "StrongPass1234",
        confirmPassword: "StrongPass1234",
      }),
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
  }
);

test(
  "Given a weak password, when resetting, then the request is rejected",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    const handler = await loadHandler("src/pages/api/portal/admin/reset-password.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admin/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: "portal_admin_reset=reset-token" },
      body: JSON.stringify({
        password: "short",
        confirmPassword: "short",
      }),
    });
    await server.close();

    assert.equal(response.status, 400);
  }
);

test(
  "Given an existing admin email, when creating, then the request is rejected",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    await db.pool.query(
      "insert into admins (id, email, name, role, password_hash) values (?,?,?,?,?)",
      [crypto.randomUUID(), "admin@example.com", "Admin", "super-admin", "hash"]
    );
    const { buildSessionToken } = await loadSessionUtils();
    const token = buildSessionToken({ email: "admin@example.com", role: "super-admin" });

    const handler = await loadHandler("src/pages/api/portal/admins/index.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `portal_admin=${token}`,
      },
      body: JSON.stringify({
        firstName: "Test",
        lastName: "Admin",
        email: "admin@example.com",
        role: "tournament-admin",
        initialPassword: "StrongPass1234",
      }),
    });
    await server.close();

    assert.equal(response.status, 409);
  }
);

test(
  "Given an import action, when requesting audit log, then the import entry is returned",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    await db.pool.query(
      `
      insert into admin_actions (id, admin_email, action, details)
      values (?,?,?,?)
      `,
      [crypto.randomUUID(), "admin@example.com", "import_xml", "{\"people\":2}"]
    );

    const { buildSessionToken } = await loadSessionUtils();
    const token = buildSessionToken({ email: "admin@example.com", role: "super-admin" });

    const handler = await loadHandler("src/pages/api/portal/admin/audit.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admin/audit`, {
      headers: {
        cookie: `portal_admin=${token}`,
      },
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.some((entry) => entry.field === "import_xml"));
  }
);

test(
  "Given a super admin, when clearing the audit log, then entries are removed",
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
    await db.pool.query(
      `
      insert into audit_logs (id, admin_email, pid, field, old_value, new_value)
      values (?,?,?,?,?,?)
      `,
      [crypto.randomUUID(), "admin@example.com", "3336", "email", "old@example.com", "new@example.com"]
    );

    const { buildSessionToken } = await loadSessionUtils();
    const token = buildSessionToken({ email: "admin@example.com", role: "super-admin" });

    const handler = await loadHandler("src/pages/api/portal/admin/audit/clear.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admin/audit/clear`, {
      method: "POST",
      headers: {
        cookie: `portal_admin=${token}`,
      },
    });
    await server.close();

    const { rows } = await db.pool.query(
      "select cast(count(*) as signed) as count from audit_logs"
    );

    assert.equal(response.status, 200);
    assert.equal(rows[0].count, 0);
  }
);

test(
  "Given an admin, when requesting logout, then the admin cookie is cleared and ok true",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    const handler = await loadHandler("src/pages/api/portal/admin/logout.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admin/logout`, {
      method: "POST",
    });
    const data = await response.json();
    const setCookie = response.headers.get("set-cookie") || "";
    await server.close();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.ok(setCookie.includes("portal_admin="));
    assert.ok(setCookie.includes("Max-Age=0"));
  }
);

test("Given participant updates, when saving, then audit entries are created", async (t) => {
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
  await seedParticipant({
    pid: "1076",
    firstName: "Dan",
    lastName: "Fahy",
    email: "dan@example.com",
    teamId: "2305",
    did: "3336",
  });

  const handler = await loadHandler("src/pages/api/portal/participants/[pid].js");
  const handlerWithPid = (req, res) => {
    const match = req.url.match(/participants\/([^/?]+)/);
    req.query = { ...(req.query || {}), pid: match?.[1] };
    return handler(req, res);
  };
  const server = await createApiServer(handlerWithPid);
  const adminCookie = await buildAdminCookie();
  const patchResponse = await fetch(`${server.url}/api/portal/participants/3336`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: adminCookie,
    },
    body: JSON.stringify({
      firstName: "Robert",
      lastName: "Aldeguer",
      email: "updated@example.com",
      phone: "555-555-0000",
      birthMonth: 1,
      birthDay: 1,
      city: "San Francisco",
      region: "CA",
      country: "US",
      team: { tnmtId: "2305", name: "Well, No Split!" },
      doubles: { did: "1076", partnerPid: "1076" },
      lanes: { team: "A", doubles: "B", singles: "C" },
      averages: { entering: 150, handicap: 10 },
      scores: { team: [100, 110, 120], doubles: [90], singles: [] },
    }),
  });
  await patchResponse.json();
  await server.close();

  const auditHandler = await loadHandler(
    "src/pages/api/portal/participants/[pid]/audit.js"
  );
  const auditHandlerWithPid = (req, res) => {
    const match = req.url.match(/participants\/([^/?]+)\/audit/);
    req.query = { ...(req.query || {}), pid: match?.[1] };
    return auditHandler(req, res);
  };
  const auditServer = await createApiServer(auditHandlerWithPid);
  const auditResponse = await fetch(
    `${auditServer.url}/api/portal/participants/3336/audit`,
    {
      headers: { cookie: adminCookie },
    }
  );
  const auditData = await auditResponse.json();
  await auditServer.close();

  assert.equal(patchResponse.status, 200);
  assert.ok(Array.isArray(auditData));
  assert.ok(auditData.some((entry) => entry.field === "email"));
});

test(
  "Given participant updates with no changes, when saving, then no audit entries are created",
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
    await seedParticipant({
      pid: "1076",
      firstName: "Dan",
      lastName: "Fahy",
      email: "dan@example.com",
      teamId: "2305",
      did: "1076",
    });

    const handler = await loadHandler("src/pages/api/portal/participants/[pid].js");
    const handlerWithPid = (req, res) => {
      const match = req.url.match(/participants\/([^/?]+)/);
      req.query = { ...(req.query || {}), pid: match?.[1] };
      return handler(req, res);
    };
    const server = await createApiServer(handlerWithPid);
    const adminCookie = await buildAdminCookie();
    const patchResponse = await fetch(`${server.url}/api/portal/participants/3336`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookie,
      },
      body: JSON.stringify({
        firstName: "Robert",
        lastName: "Aldeguer",
        email: "robert@example.com",
        phone: "555-555-5555",
        birthMonth: 1,
        birthDay: 1,
        city: "San Francisco",
        region: "CA",
        country: "US",
        team: { tnmtId: "2305", name: "Well, No Split!" },
        doubles: { did: "1076", partnerPid: "1076" },
        lanes: { team: "", doubles: "", singles: "" },
        averages: { entering: null, handicap: null },
        scores: { team: [], doubles: [], singles: [] },
      }),
    });
    await patchResponse.json();
    await server.close();

    const auditHandler = await loadHandler(
      "src/pages/api/portal/participants/[pid]/audit.js"
    );
    const auditHandlerWithPid = (req, res) => {
      const match = req.url.match(/participants\/([^/?]+)\/audit/);
      req.query = { ...(req.query || {}), pid: match?.[1] };
      return auditHandler(req, res);
    };
    const auditServer = await createApiServer(auditHandlerWithPid);
    const auditResponse = await fetch(
      `${auditServer.url}/api/portal/participants/3336/audit`,
      {
        headers: { cookie: adminCookie },
      }
    );
    const auditData = await auditResponse.json();
    await auditServer.close();

    assert.equal(patchResponse.status, 200);
    assert.ok(Array.isArray(auditData));
    assert.equal(auditData.length, 0);
  }
);

test(
  "Given a participant login, when verifying within 30 minutes, then a 48h session cookie is issued",
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

    const loginHandler = await loadHandler("src/pages/api/portal/participant/login.js");
    const loginServer = await createApiServer(loginHandler);
    const loginResponse = await fetch(`${loginServer.url}/api/portal/participant/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "robert@example.com" }),
    });
    const loginData = await loginResponse.json();
    await loginServer.close();

    const verifyHandler = await loadHandler("src/pages/api/portal/participant/verify.js");
    const verifyServer = await createApiServer(verifyHandler);
    const verifyResponse = await fetch(
      `${verifyServer.url}/api/portal/participant/verify?token=${loginData.token}`,
      { redirect: "manual" }
    );
    const verifyCookie = parseCookie(verifyResponse.headers.get("set-cookie"));
    await verifyServer.close();

    const { verifyToken } = await loadSessionUtils();
    const tokenValue = verifyCookie.split("=")[1];
    const payload = verifyToken(tokenValue);

    assert.equal(verifyResponse.status, 302);
    assert.ok(verifyResponse.headers.get("location")?.includes("/portal/participant/"));
    assert.ok(payload?.exp);
    const ttlMs = payload.exp - Date.now();
    assert.ok(ttlMs > 47.5 * 60 * 60 * 1000);
    assert.ok(ttlMs <= 48 * 60 * 60 * 1000);
  }
);

test(
  "Given a participant login payload with email or phone, when requesting a link, then a token is returned",
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

    const emailResponse = await fetch(`${server.url}/api/portal/participant/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "robert@example.com" }),
    });
    const emailData = await emailResponse.json();

    const phoneResponse = await fetch(`${server.url}/api/portal/participant/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "555-555-5555" }),
    });
    const phoneData = await phoneResponse.json();

    await server.close();

    assert.equal(emailResponse.status, 200);
    assert.ok(emailData.token);
    assert.equal(phoneResponse.status, 200);
    assert.ok(phoneData.token);
  }
);

test(
  "Given an expired participant link, when verifying, then redirect to login with expired message",
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
    const expiredToken = "expired-token";
    await db.pool.query(
      `
      insert into participant_login_tokens (token, pid, expires_at)
      values (?,?, date_sub(now(), interval 1 minute))
      `,
      [expiredToken, "3336"]
    );

    const verifyHandler = await loadHandler("src/pages/api/portal/participant/verify.js");
    const verifyServer = await createApiServer(verifyHandler);
    const verifyResponse = await fetch(
      `${verifyServer.url}/api/portal/participant/verify?token=${expiredToken}`,
      { redirect: "manual" }
    );
    await verifyServer.close();

    assert.equal(verifyResponse.status, 302);
    assert.ok(
      verifyResponse.headers.get("location")?.includes("/portal/participant?expired=1")
    );
  }
);

test(
  "Given a team with a captain and doubles pairings, when fetching by slug, then roster is ordered",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    await db.pool.query(
      "insert into teams (tnmt_id, team_name, slug) values (?,?,?)",
      ["2305", "Well, No Split!", "well-no-split"]
    );
    await seedTeamMember({
      pid: "1001",
      firstName: "Alice",
      lastName: "Captain",
      email: "alice@example.com",
      teamId: "2305",
      did: "D1001",
      teamCaptain: true,
      teamOrder: 1,
    });
    await seedTeamMember({
      pid: "1002",
      firstName: "Bob",
      lastName: "Partner",
      email: "bob@example.com",
      teamId: "2305",
      did: "D1002",
      teamCaptain: false,
      teamOrder: 2,
    });
    await seedTeamMember({
      pid: "1003",
      firstName: "Carol",
      lastName: "Third",
      email: "carol@example.com",
      teamId: "2305",
      did: "D1003",
      teamCaptain: false,
      teamOrder: 3,
    });
    await seedTeamMember({
      pid: "1004",
      firstName: "Dave",
      lastName: "Fourth",
      email: "dave@example.com",
      teamId: "2305",
      did: "D1004",
      teamCaptain: false,
      teamOrder: 4,
    });
    await db.pool.query(
      `
      insert into doubles_pairs (did, pid, partner_pid)
      values (?,?,?), (?,?,?), (?,?,?), (?,?,?)
      `,
      [
        "D1001",
        "1001",
        "1002",
        "D1002",
        "1002",
        "1001",
        "D1003",
        "1003",
        "1004",
        "D1004",
        "1004",
        "1003",
      ]
    );

    const handler = await loadHandler("src/pages/api/portal/teams/[teamSlug].js");
    const handlerWithSlug = (req, res) => {
      const match = req.url.match(/teams\/([^/?]+)/);
      req.query = { ...(req.query || {}), teamSlug: match?.[1] };
      return handler(req, res);
    };
    const server = await createApiServer(handlerWithSlug);
    const adminCookie = await buildAdminCookie();
    const response = await fetch(`${server.url}/api/portal/teams/well-no-split`, {
      headers: { cookie: adminCookie },
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.equal(data.team.slug, "well-no-split");
    assert.equal(data.roster.length, 4);
    assert.equal(data.roster[0].pid, "1001");
    assert.equal(data.roster[1].pid, "1002");
    assert.equal(data.roster[2].pid, "1003");
    assert.equal(data.roster[3].pid, "1004");
  }
);

test(
  "Given a team without a slug, when fetching by slug, then fallback matches team name",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    await db.pool.query("insert into teams (tnmt_id, team_name) values (?,?)", [
      "2501",
      "Fallback Squad",
    ]);
    await seedTeamMember({
      pid: "3001",
      firstName: "Fran",
      lastName: "Fallback",
      email: "fran@example.com",
      teamId: "2501",
      did: "D3001",
      teamCaptain: true,
      teamOrder: 1,
    });

    const handler = await loadHandler("src/pages/api/portal/teams/[teamSlug].js");
    const handlerWithSlug = (req, res) => {
      const match = req.url.match(/teams\/([^/?]+)/);
      req.query = { ...(req.query || {}), teamSlug: match?.[1] };
      return handler(req, res);
    };
    const server = await createApiServer(handlerWithSlug);
    const adminCookie = await buildAdminCookie();
    const response = await fetch(`${server.url}/api/portal/teams/fallback-squad`, {
      headers: { cookie: adminCookie },
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.equal(data.team.tnmtId, "2501");
    assert.equal(data.team.name, "Fallback Squad");
  }
);

test(
  "Given a team without a captain, when fetching by slug, then roster is ordered by team order",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    await db.pool.query(
      "insert into teams (tnmt_id, team_name, slug) values (?,?,?)",
      ["2401", "Late Splitters", "late-splitters"]
    );
    await seedTeamMember({
      pid: "2001",
      firstName: "Zara",
      lastName: "Late",
      email: "zara@example.com",
      teamId: "2401",
      did: "D2001",
      teamCaptain: false,
      teamOrder: 3,
    });
    await seedTeamMember({
      pid: "2002",
      firstName: "Aly",
      lastName: "Early",
      email: "aly@example.com",
      teamId: "2401",
      did: "D2002",
      teamCaptain: false,
      teamOrder: 1,
    });
    await seedTeamMember({
      pid: "2003",
      firstName: "Moe",
      lastName: "Middle",
      email: "moe@example.com",
      teamId: "2401",
      did: "D2003",
      teamCaptain: false,
      teamOrder: 2,
    });

    const handler = await loadHandler("src/pages/api/portal/teams/[teamSlug].js");
    const handlerWithSlug = (req, res) => {
      const match = req.url.match(/teams\/([^/?]+)/);
      req.query = { ...(req.query || {}), teamSlug: match?.[1] };
      return handler(req, res);
    };
    const server = await createApiServer(handlerWithSlug);
    const adminCookie = await buildAdminCookie();
    const response = await fetch(`${server.url}/api/portal/teams/late-splitters`, {
      headers: { cookie: adminCookie },
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.equal(data.roster.length, 3);
    assert.equal(data.roster[0].pid, "2002");
    assert.equal(data.roster[1].pid, "2003");
    assert.equal(data.roster[2].pid, "2001");
  }
);

test(
  "Given a roster with location data, when fetching by slug, then team location is included",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    await db.pool.query(
      "insert into teams (tnmt_id, team_name, slug) values (?,?,?)",
      ["2601", "Location Squad", "location-squad"]
    );
    await seedTeamMember({
      pid: "4001",
      firstName: "Casey",
      lastName: "Captain",
      email: "casey@example.com",
      teamId: "2601",
      did: "D4001",
      teamCaptain: true,
      teamOrder: 1,
      city: "Oakland",
      region: "CA",
      country: "US",
    });
    await seedTeamMember({
      pid: "4002",
      firstName: "Pat",
      lastName: "Partner",
      email: "pat@example.com",
      teamId: "2601",
      did: "D4002",
      teamCaptain: false,
      teamOrder: 2,
    });

    const handler = await loadHandler("src/pages/api/portal/teams/[teamSlug].js");
    const handlerWithSlug = (req, res) => {
      const match = req.url.match(/teams\/([^/?]+)/);
      req.query = { ...(req.query || {}), teamSlug: match?.[1] };
      return handler(req, res);
    };
    const server = await createApiServer(handlerWithSlug);
    const adminCookie = await buildAdminCookie();
    const response = await fetch(`${server.url}/api/portal/teams/location-squad`, {
      headers: { cookie: adminCookie },
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.deepEqual(data.team.location, {
      city: "Oakland",
      region: "CA",
      country: "US",
    });
  }
);

test(
  "Given only an email and no phone, when creating an admin, then the account is created",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    const adminCookie = await buildAdminCookie();
    const uniqueEmail = `emailonly-${crypto.randomUUID()}@example.com`;

    const handler = await loadHandler("src/pages/api/portal/admins/index.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookie,
      },
      body: JSON.stringify({
        firstName: "Email",
        lastName: "Only",
        email: uniqueEmail,
        role: "tournament-admin",
        initialPassword: "StrongPass1234",
      }),
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);

    const { rows } = await db.pool.query(
      "select email, phone from admins where email = ?",
      [uniqueEmail]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, uniqueEmail);
    assert.ok(!rows[0].phone, "phone should be null when not provided");
  }
);

test(
  "Given only a phone and no email, when creating an admin, then the account is created",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    const adminCookie = await buildAdminCookie();
    const uniquePhone = `555-${crypto.randomUUID().slice(0, 8)}`;

    const handler = await loadHandler("src/pages/api/portal/admins/index.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookie,
      },
      body: JSON.stringify({
        firstName: "Phone",
        lastName: "Only",
        phone: uniquePhone,
        role: "tournament-admin",
        initialPassword: "StrongPass1234",
      }),
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);

    const { rows } = await db.pool.query(
      "select email, phone from admins where phone = ?",
      [uniquePhone]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].phone, uniquePhone);
    assert.ok(!rows[0].email, "email should be null when not provided");
  }
);

test(
  "Given neither email nor phone, when creating an admin, then the request is rejected with specific error",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    const adminCookie = await buildAdminCookie();

    const handler = await loadHandler("src/pages/api/portal/admins/index.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookie,
      },
      body: JSON.stringify({
        firstName: "No",
        lastName: "Contact",
        role: "tournament-admin",
        initialPassword: "StrongPass1234",
      }),
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 400);
    assert.ok(
      data.error.includes("email or phone"),
      `Expected error to mention "email or phone", got: ${data.error}`
    );
  }
);

test(
  "Given missing first name, when creating an admin, then the error message includes first name",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    const adminCookie = await buildAdminCookie();

    const handler = await loadHandler("src/pages/api/portal/admins/index.js");
    const server = await createApiServer(handler);
    const response = await fetch(`${server.url}/api/portal/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookie,
      },
      body: JSON.stringify({
        lastName: "NoFirst",
        email: `nofirst-${crypto.randomUUID()}@example.com`,
        role: "tournament-admin",
        initialPassword: "StrongPass1234",
      }),
    });
    const data = await response.json();
    await server.close();

    assert.equal(response.status, 400);
    assert.ok(
      data.error.includes("first name"),
      `Expected error to mention "first name", got: ${data.error}`
    );
  }
);

test(
  "Given a duplicate email, when creating an admin twice, then the second request returns 409",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    const adminCookie = await buildAdminCookie();
    const duplicateEmail = `dup-${crypto.randomUUID()}@example.com`;
    const adminBody = {
      firstName: "Dup",
      lastName: "Admin",
      email: duplicateEmail,
      role: "tournament-admin",
      initialPassword: "StrongPass1234",
    };

    const handler = await loadHandler("src/pages/api/portal/admins/index.js");
    const server = await createApiServer(handler);

    const firstResponse = await fetch(`${server.url}/api/portal/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookie,
      },
      body: JSON.stringify(adminBody),
    });
    const firstData = await firstResponse.json();

    const secondResponse = await fetch(`${server.url}/api/portal/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: adminCookie,
      },
      body: JSON.stringify(adminBody),
    });
    const secondData = await secondResponse.json();
    await server.close();

    assert.equal(firstResponse.status, 200);
    assert.equal(firstData.ok, true);
    assert.equal(secondResponse.status, 409);
    assert.ok(
      secondData.error.includes("already exists"),
      `Expected error to mention "already exists", got: ${secondData.error}`
    );
  }
);
