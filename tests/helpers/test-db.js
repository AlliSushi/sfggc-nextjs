const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

const findEnvLocal = (startDir) => {
  let current = startDir;
  while (current && current !== path.dirname(current)) {
    const candidate = path.join(current, ".env.local");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    current = path.dirname(current);
  }
  return null;
};

const loadEnvFromFile = (envPath = null) => {
  const fallback = path.join(__dirname, "..", "..", ".env.local");
  const resolvedPath =
    envPath || findEnvLocal(process.cwd()) || (fs.existsSync(fallback) ? fallback : null);
  if (!resolvedPath || !fs.existsSync(resolvedPath)) return;
  const raw = fs.readFileSync(resolvedPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
    const sanitized = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length)
      : trimmed;
    const index = sanitized.indexOf("=");
    const key = sanitized.slice(0, index).trim();
    let value = sanitized.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

const getTestDatabaseUrl = () => {
  const explicit = process.env.PORTAL_TEST_DATABASE_URL;
  if (explicit) return explicit;
  const base = process.env.PORTAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) return null;
  try {
    const url = new URL(base);
    const currentDb = url.pathname.replace(/^\//, "");
    const testDb = currentDb ? `${currentDb}_test` : "sfggc_portal_test";
    url.pathname = `/${testDb}`;
    return url.toString();
  } catch (error) {
    return null;
  }
};

const ensureDatabaseExists = async (testUrl) => {
  const url = new URL(testUrl);
  const dbName = url.pathname.replace(/^\//, "");
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/mysql";
  const pool = mysql.createPool({ uri: adminUrl.toString(), multipleStatements: true });
  try {
    const [rows] = await pool.query(
      "select 1 from information_schema.schemata where schema_name = ?",
      [dbName]
    );
    if (!rows.length) {
      await pool.query(`create database \`${dbName}\``);
    }
  } finally {
    await pool.end();
  }
};

const applySchema = async (pool) => {
  const schemaPath = path.join(process.cwd(), "portal_docs", "sql", "portal_schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schema);
};

const dropAll = async (pool) => {
  await pool.query(
    "drop table if exists audit_logs, scores, doubles_pairs, people, teams, participant_login_tokens, admin_actions, admin_password_resets, admins"
  );
};

const truncateAll = async (pool) => {
  await pool.query("set foreign_key_checks = 0");
  await pool.query(
    "truncate table audit_logs, scores, doubles_pairs, people, teams, participant_login_tokens, admin_actions, admin_password_resets, admins"
  );
  await pool.query("set foreign_key_checks = 1");
};

const initTestDb = async () => {
  loadEnvFromFile();
  const testUrl = getTestDatabaseUrl();
  if (!testUrl) {
    throw new Error(
      "Set PORTAL_DATABASE_URL or PORTAL_TEST_DATABASE_URL to run DB tests."
    );
  }
  await ensureDatabaseExists(testUrl);
  process.env.PORTAL_DATABASE_URL = testUrl;
  const pool = mysql.createPool({ uri: testUrl, multipleStatements: true });
  await dropAll(pool);
  await applySchema(pool);
  return {
    pool,
    testUrl,
    reset: async () => truncateAll(pool),
    close: async () => pool.end(),
  };
};

module.exports = {
  initTestDb,
  getTestDatabaseUrl,
  loadEnvFromFile,
};
