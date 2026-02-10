import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { initTestDb } from "../helpers/test-db.js";

/**
 * BDD tests for database performance indexes.
 *
 * These tests verify that foreign key columns have indexes for query
 * performance. Without these indexes, JOIN queries and foreign key
 * lookups result in full table scans.
 *
 * Required indexes:
 * - people(tnmt_id) - for team lookups
 * - people(did) - for doubles pair lookups
 * - doubles_pairs(pid) - for participant doubles lookups
 * - doubles_pairs(partner_pid) - for reverse partner lookups
 * - scores(pid) - for participant score lookups
 * - admins(phone) - for admin phone number lookups
 */

let testDb;

before(async () => {
  testDb = await initTestDb();
});

after(async () => {
  if (testDb) {
    await testDb.close();
  }
});

/**
 * Helper to check if an index exists on a table column.
 * Returns true if an index exists where the column is the first column in the index.
 */
const hasIndexOnColumn = async (tableName, columnName, pool) => {
  // mysql2 pool.query returns [rows, fields], not { rows }
  const [rows] = await pool.query(
    "SHOW INDEX FROM ?? WHERE Column_name = ? AND Seq_in_index = 1",
    [tableName, columnName]
  );
  return rows.length > 0;
};

test(
  "Given the people table, when checking indexes, then it has an index on tnmt_id for team lookups",
  async () => {
    const hasIndex = await hasIndexOnColumn("people", "tnmt_id", testDb.pool);

    assert.ok(
      hasIndex,
      "people table must have an index on tnmt_id to optimize 'SELECT * FROM teams WHERE tnmt_id = ?' queries"
    );
  }
);

test(
  "Given the people table, when checking indexes, then it has an index on did for doubles pair lookups",
  async () => {
    const hasIndex = await hasIndexOnColumn("people", "did", testDb.pool);

    assert.ok(
      hasIndex,
      "people table must have an index on did to optimize 'SELECT * FROM people WHERE did = ?' queries"
    );
  }
);

test(
  "Given the doubles_pairs table, when checking indexes, then it has an index on pid for participant lookups",
  async () => {
    const hasIndex = await hasIndexOnColumn("doubles_pairs", "pid", testDb.pool);

    assert.ok(
      hasIndex,
      "doubles_pairs table must have an index on pid to optimize 'SELECT * FROM doubles_pairs WHERE pid = ?' queries"
    );
  }
);

test(
  "Given the doubles_pairs table, when checking indexes, then it has an index on partner_pid for reverse lookups",
  async () => {
    const hasIndex = await hasIndexOnColumn("doubles_pairs", "partner_pid", testDb.pool);

    assert.ok(
      hasIndex,
      "doubles_pairs table must have an index on partner_pid to optimize partner lookups and reverse joins"
    );
  }
);

test(
  "Given the scores table, when checking indexes, then it has an index on pid for participant score lookups",
  async () => {
    const hasIndex = await hasIndexOnColumn("scores", "pid", testDb.pool);

    assert.ok(
      hasIndex,
      "scores table must have an index on pid to optimize 'SELECT * FROM scores WHERE pid = ?' queries"
    );
  }
);

test(
  "Given the admins table, when checking indexes, then it has an index on phone for phone number lookups",
  async () => {
    const hasIndex = await hasIndexOnColumn("admins", "phone", testDb.pool);

    assert.ok(
      hasIndex,
      "admins table must have an index on phone to optimize admin lookup by phone number"
    );
  }
);

test(
  "Given the database schema, when checking index strategy, then foreign key columns used in WHERE clauses have indexes",
  async () => {
    // This is a meta-test that validates our indexing strategy
    const requiredIndexes = [
      { table: "people", column: "tnmt_id" },
      { table: "people", column: "did" },
      { table: "doubles_pairs", column: "pid" },
      { table: "doubles_pairs", column: "partner_pid" },
      { table: "scores", column: "pid" },
      { table: "admins", column: "phone" },
    ];

    const missingIndexes = [];
    for (const { table, column } of requiredIndexes) {
      const hasIndex = await hasIndexOnColumn(table, column, testDb.pool);
      if (!hasIndex) {
        missingIndexes.push(`${table}.${column}`);
      }
    }

    assert.equal(
      missingIndexes.length,
      0,
      `All foreign key columns must have indexes. Missing: ${missingIndexes.join(", ")}`
    );
  }
);
