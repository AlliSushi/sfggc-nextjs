const { before, beforeEach, after } = require("node:test");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { initTestDb } = require("./test-db");

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

const parseCookie = (cookieHeader) => cookieHeader?.split(";")[0] || "";

const seedDefaultAdmin = async (pool, role = "super-admin", email = "admin@example.com") => {
  await pool.query(
    "insert ignore into admins (id, email, name, role, password_hash) values (?,?,?,?,?)",
    [crypto.randomUUID(), email, "Admin", role, "not-a-real-hash"]
  );
};

const seedParticipant = async (
  pool,
  {
    pid,
    firstName,
    lastName,
    email,
    teamId,
    did,
    city = "San Francisco",
    region = "CA",
    country = "US",
  }
) => {
  await pool.query(
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
      city,
      region,
      country,
      teamId,
      did,
    ]
  );
};

const wrapHandlerWithQueryParam = (handler, pattern, paramName) => {
  return (req, res) => {
    const match = req.url.match(pattern);
    req.query = { ...(req.query || {}), [paramName]: match?.[1] };
    return handler(req, res);
  };
};

const setupIntegrationDb = () => {
  const state = {
    db: null,
    dbReady: false,
    dbSkipReason: "",
  };

  before(async () => {
    try {
      state.db = await initTestDb();
      state.dbReady = true;
    } catch (error) {
      state.dbReady = false;
      state.dbSkipReason = error.message;
    }
  });

  beforeEach(async () => {
    if (!state.dbReady) return;
    await state.db.reset();
  });

  after(async () => {
    const { closePool } = await import(
      pathToFileURL(path.join(process.cwd(), "src/utils/portal/db.js"))
    );
    await closePool();
    if (!state.dbReady) return;
    await state.db.close();
  });

  return state;
};

const requireDb = (t, state) => {
  if (!state.dbReady) {
    t.skip(state.dbSkipReason || "Database not available");
    return null;
  }
  return state.db;
};

module.exports = {
  loadHandler,
  loadSessionUtils,
  buildAdminCookie,
  parseCookie,
  seedDefaultAdmin,
  seedParticipant,
  wrapHandlerWithQueryParam,
  setupIntegrationDb,
  requireDb,
};
