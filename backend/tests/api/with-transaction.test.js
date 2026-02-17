import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

/**
 * Unit tests for withTransaction in src/utils/portal/db.js.
 *
 * We cannot import withTransaction directly because db.js creates a real
 * mysql pool on import. Instead we replicate the withTransaction logic
 * against a mock connection to verify the commit/rollback/release contract.
 * This keeps the test fast, DB-free, and focused on the orchestration.
 */

/* ------------------------------------------------------------------ */
/*  Shared mock helpers                                               */
/* ------------------------------------------------------------------ */

const buildMockConnection = () => {
  const calls = [];
  return {
    calls,
    beginTransaction: async () => calls.push("beginTransaction"),
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
    query: async (text, params = []) => {
      calls.push(`query:${text.trim().slice(0, 40)}`);
      return [[]];
    },
  };
};

/**
 * Faithful replica of withTransaction from db.js so we can test the
 * orchestration against our mock connection without needing a real pool.
 */
const withTransaction = async (getConnection, fn) => {
  const conn = await getConnection();
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

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

test("Given a successful callback, when withTransaction runs, then it commits and releases", async () => {
  // Arrange
  const conn = buildMockConnection();
  const getConnection = async () => conn;

  // Act
  const result = await withTransaction(getConnection, async (query) => {
    await query("insert into teams (tnmt_id) values (?)", ["123"]);
    return "done";
  });

  // Assert
  assert.equal(result, "done");
  assert.equal(conn.calls[0], "beginTransaction");
  assert.ok(conn.calls[1].startsWith("query:"));
  assert.equal(conn.calls[2], "commit");
  assert.equal(conn.calls[3], "release");
  assert.ok(!conn.calls.includes("rollback"), "rollback must not be called on success");
});

test("Given a failing callback, when withTransaction runs, then it rolls back and releases", async () => {
  // Arrange
  const conn = buildMockConnection();
  const getConnection = async () => conn;
  const expectedError = new Error("insert failed");

  // Act + Assert
  await assert.rejects(
    () =>
      withTransaction(getConnection, async (query) => {
        await query("insert into people (pid) values (?)", ["456"]);
        throw expectedError;
      }),
    (error) => {
      assert.equal(error, expectedError);
      return true;
    }
  );

  assert.equal(conn.calls[0], "beginTransaction");
  assert.ok(conn.calls[1].startsWith("query:"));
  assert.equal(conn.calls[2], "rollback");
  assert.equal(conn.calls[3], "release");
  assert.ok(!conn.calls.includes("commit"), "commit must not be called on failure");
});

test("Given a failing callback, when withTransaction runs, then the original error is re-thrown", async () => {
  // Arrange
  const conn = buildMockConnection();
  const getConnection = async () => conn;

  // Act + Assert
  await assert.rejects(
    () =>
      withTransaction(getConnection, async () => {
        throw new Error("unique constraint violated");
      }),
    { message: "unique constraint violated" }
  );
});

test("Given multiple queries in the callback, when withTransaction succeeds, then all use the same connection", async () => {
  // Arrange
  const conn = buildMockConnection();
  const getConnection = async () => conn;

  // Act
  await withTransaction(getConnection, async (query) => {
    await query("insert into teams (tnmt_id) values (?)", ["1"]);
    await query("insert into people (pid) values (?)", ["2"]);
    await query("insert into scores (pid) values (?)", ["3"]);
  });

  // Assert - all queries should go through the same connection
  const queryCount = conn.calls.filter((c) => c.startsWith("query:")).length;
  assert.equal(queryCount, 3);
  assert.equal(conn.calls[0], "beginTransaction");
  assert.equal(conn.calls[conn.calls.length - 2], "commit");
  assert.equal(conn.calls[conn.calls.length - 1], "release");
});

test("Given the callback returns a value, when withTransaction completes, then the value is returned", async () => {
  // Arrange
  const conn = buildMockConnection();
  const getConnection = async () => conn;

  // Act
  const result = await withTransaction(getConnection, async () => {
    return { imported: 42 };
  });

  // Assert
  assert.deepEqual(result, { imported: 42 });
});

test("Given connQuery is called, when it executes, then it returns rows in the same shape as db.query", async () => {
  // Arrange
  const conn = buildMockConnection();
  // Override query to return real data in mysql2 format: [[row1, row2]]
  conn.query = async () => [[{ pid: "1" }, { pid: "2" }]];
  const getConnection = async () => conn;

  // Act
  let capturedRows;
  await withTransaction(getConnection, async (query) => {
    const result = await query("select pid from people");
    capturedRows = result.rows;
  });

  // Assert - connQuery wraps mysql2 [rows] into { rows }
  assert.deepEqual(capturedRows, [{ pid: "1" }, { pid: "2" }]);
});

test("Given an error after begin, when connection releases, then release always happens", async () => {
  // Arrange
  const conn = buildMockConnection();
  // Make commit throw to simulate a connection error
  conn.commit = async () => {
    conn.calls.push("commit");
    throw new Error("commit failed");
  };
  const getConnection = async () => conn;

  // Act + Assert
  await assert.rejects(
    () =>
      withTransaction(getConnection, async () => {
        return "ok";
      }),
    { message: "commit failed" }
  );

  // release must still be called even when commit throws
  assert.ok(conn.calls.includes("release"), "release must be called even if commit fails");
});
