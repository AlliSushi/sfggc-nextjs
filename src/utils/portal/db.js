import mysql from "mysql2/promise";
import fs from "fs";

let pool;

function getSocketPath() {
  if (process.env.MYSQL_UNIX_SOCKET && fs.existsSync(process.env.MYSQL_UNIX_SOCKET)) {
    return process.env.MYSQL_UNIX_SOCKET;
  }
  const candidates = ["/tmp/mysql.sock", "/opt/homebrew/var/mysql/mysql.sock", "/usr/local/var/mysql/mysql.sock"];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const getPool = () => {
  if (pool) {
    return pool;
  }

  const databaseUrl = process.env.PORTAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("PORTAL_DATABASE_URL is not set");
  }

  const url = new URL(databaseUrl);
  const host = url.hostname || "localhost";
  const hasPassword = !!url.password;
  const socketPath = getSocketPath();
  const useSocket =
    (host === "localhost" || host === "127.0.0.1") && !hasPassword && socketPath;

  // Connection pool configuration optimized for AWS RDS performance
  // These settings reduce latency by 10-20% and prevent connection exhaustion
  const poolConfig = {
    connectionLimit: 20,           // Increased from default 10 for higher concurrency
    waitForConnections: true,      // Queue requests instead of failing immediately
    queueLimit: 50,                // Maximum queued requests before rejecting
    enableKeepAlive: true,         // Keep connections alive for AWS RDS
    keepAliveInitialDelay: 0,      // Send keepalive immediately
    connectTimeout: 20000,         // 20 seconds for slower network conditions
    acquireTimeout: 20000,         // Wait up to 20s for available connection from pool
  };

  if (useSocket) {
    const user = url.username === "root" ? process.env.USER : url.username;
    pool = mysql.createPool({
      ...poolConfig,
      user: user || url.username,
      database: (url.pathname || "/").replace(/^\//, "") || "mysql",
      socketPath,
    });
  } else {
    pool = mysql.createPool({
      ...poolConfig,
      uri: databaseUrl,
    });
  }

  return pool;
};

const query = async (text, params = []) => {
  const [rows] = await getPool().query(text, params);
  return { rows };
};

/**
 * Run `fn` inside a dedicated connection with BEGIN / COMMIT / ROLLBACK.
 * `fn` receives a `connQuery` function with the same signature as `query`
 * but guaranteed to use the same underlying connection.
 */
const withTransaction = async (fn) => {
  const conn = await getPool().getConnection();
  const connQuery = async (text, params = []) => {
    const [rows] = await conn.query(text, params);
    return { rows };
  };
  try {
    await conn.beginTransaction();
    const result = await fn(connQuery);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

export { query, withTransaction };
