import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

/**
 * BDD tests for database connection pool configuration optimizations.
 *
 * These tests verify that the database connection pool has performance
 * optimizations for AWS RDS and high-concurrency scenarios:
 * - Increased connection limit
 * - Connection queueing enabled
 * - Keep-alive enabled for AWS RDS compatibility
 * - Appropriate timeouts
 */

const DB_MODULE_PATH = path.join(
  process.cwd(),
  "src/utils/portal/db.js"
);

test(
  "Given the db.js module, when checking file, then it exists",
  () => {
    assert.ok(
      fs.existsSync(DB_MODULE_PATH),
      "db.js must exist at src/utils/portal/db.js"
    );
  }
);

test(
  "Given the db.js module, when creating connection pool, then connectionLimit is set to 20 for high concurrency",
  () => {
    const content = fs.readFileSync(DB_MODULE_PATH, "utf-8");

    assert.ok(
      content.includes("connectionLimit") && content.includes("20"),
      "Connection pool must have connectionLimit: 20 for high concurrency"
    );
  }
);

test(
  "Given the db.js module, when creating connection pool, then waitForConnections is true to prevent request failures",
  () => {
    const content = fs.readFileSync(DB_MODULE_PATH, "utf-8");

    assert.ok(
      content.match(/waitForConnections\s*:\s*true/i),
      "Connection pool must have waitForConnections: true to queue requests instead of failing"
    );
  }
);

test(
  "Given the db.js module, when creating connection pool, then queueLimit is set to 50 for request buffering",
  () => {
    const content = fs.readFileSync(DB_MODULE_PATH, "utf-8");

    assert.ok(
      content.includes("queueLimit") && content.includes("50"),
      "Connection pool must have queueLimit: 50 to buffer concurrent requests"
    );
  }
);

test(
  "Given the db.js module, when creating connection pool, then enableKeepAlive is true for AWS RDS compatibility",
  () => {
    const content = fs.readFileSync(DB_MODULE_PATH, "utf-8");

    assert.ok(
      content.match(/enableKeepAlive\s*:\s*true/i),
      "Connection pool must have enableKeepAlive: true to prevent AWS RDS connection drops"
    );
  }
);

test(
  "Given the db.js module, when creating connection pool, then connectTimeout is set to 20000ms",
  () => {
    const content = fs.readFileSync(DB_MODULE_PATH, "utf-8");

    assert.ok(
      content.includes("connectTimeout") && content.includes("20000"),
      "Connection pool must have connectTimeout: 20000 for slower network conditions"
    );
  }
);

test(
  "Given the db.js module, when creating connection pool, then acquireTimeout is NOT used (unsupported by mysql2)",
  () => {
    const content = fs.readFileSync(DB_MODULE_PATH, "utf-8");

    assert.ok(
      !content.includes("acquireTimeout"),
      "Connection pool must NOT use acquireTimeout (not supported by mysql2, causes deprecation warning)"
    );
  }
);

test(
  "Given the db.js module, when creating pool for socket connections, then it also includes performance optimizations",
  () => {
    const content = fs.readFileSync(DB_MODULE_PATH, "utf-8");

    // Find the socket pool creation section
    const socketPoolMatch = content.match(/if \(useSocket\)\s*{[\s\S]*?pool = mysql\.createPool\(\{[\s\S]*?\}\);/);

    assert.ok(
      socketPoolMatch,
      "Socket pool creation block must exist"
    );

    const socketPoolContent = socketPoolMatch[0];

    // Socket pool should also have the performance optimizations
    assert.ok(
      socketPoolContent.includes("connectionLimit") ||
      content.match(/const\s+poolConfig\s*=/), // Or uses shared config
      "Socket pool must also include connection pool optimizations"
    );
  }
);

test(
  "Given the db.js module, when creating pool for URL connections, then it includes all performance optimizations",
  () => {
    const content = fs.readFileSync(DB_MODULE_PATH, "utf-8");

    // Find the URL-based pool creation (the else branch)
    const urlPoolMatch = content.match(/else\s*{[\s\S]*?pool = mysql\.createPool\([\s\S]*?\);/);

    assert.ok(
      urlPoolMatch,
      "URL-based pool creation block must exist"
    );

    const urlPoolContent = urlPoolMatch[0];

    // URL pool should include optimizations or extend the URL with a config object
    const hasOptimizations =
      urlPoolContent.includes("connectionLimit") ||
      urlPoolContent.includes("waitForConnections") ||
      content.match(/const\s+poolConfig\s*=/) || // Shared config pattern
      urlPoolContent.match(/\{\s*uri\s*:.*,[\s\S]*?connectionLimit/); // Config object pattern

    assert.ok(
      hasOptimizations,
      "URL-based pool must include performance optimizations or use shared config"
    );
  }
);
