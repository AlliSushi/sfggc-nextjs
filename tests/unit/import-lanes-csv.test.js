import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLaneValue,
  validateColumns,
  matchParticipants,
  importLanes,
} from "../../src/utils/portal/importLanesCsv.js";

// ---------------------------------------------------------------------------
// normalizeLaneValue
// ---------------------------------------------------------------------------

describe("normalizeLaneValue", () => {
  it('Given "#N/A", when normalized, then returns null', () => {
    assert.strictEqual(normalizeLaneValue("#N/A"), null);
  });

  it('Given "27", when normalized, then returns "27"', () => {
    assert.strictEqual(normalizeLaneValue("27"), "27");
  });

  it('Given " " (whitespace only), when normalized, then returns null', () => {
    assert.strictEqual(normalizeLaneValue(" "), null);
  });

  it('Given "" (empty string), when normalized, then returns null', () => {
    assert.strictEqual(normalizeLaneValue(""), null);
  });

  it("Given undefined, when normalized, then returns null", () => {
    assert.strictEqual(normalizeLaneValue(undefined), null);
  });

  it('Given "  15  " (padded with spaces), when normalized, then returns "15"', () => {
    assert.strictEqual(normalizeLaneValue("  15  "), "15");
  });
});

// ---------------------------------------------------------------------------
// validateColumns
// ---------------------------------------------------------------------------

describe("validateColumns", () => {
  it("Given headers with all required columns, when validated, then valid is true", () => {
    const result = validateColumns(["PID", "T_Lane", "D_Lane", "S_Lane"]);

    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.missing, []);
  });

  it('Given headers missing T_Lane, when validated, then valid is false with missing containing "T_Lane"', () => {
    const result = validateColumns(["PID", "D_Lane", "S_Lane"]);

    assert.strictEqual(result.valid, false);
    assert.ok(
      result.missing.includes("T_Lane"),
      `Expected missing to include "T_Lane", got: ${JSON.stringify(result.missing)}`
    );
  });

  it("Given headers with extra columns beyond required, when validated, then valid is true", () => {
    const result = validateColumns([
      "PID",
      "T_Lane",
      "D_Lane",
      "S_Lane",
      "Name",
      "Email",
    ]);

    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.missing, []);
  });

  it("Given empty headers array, when validated, then valid is false with all required columns missing", () => {
    const result = validateColumns([]);

    assert.strictEqual(result.valid, false);
    assert.ok(
      result.missing.includes("PID"),
      `Expected missing to include "PID", got: ${JSON.stringify(result.missing)}`
    );
    assert.ok(
      result.missing.includes("T_Lane"),
      `Expected missing to include "T_Lane", got: ${JSON.stringify(result.missing)}`
    );
    assert.ok(
      result.missing.includes("D_Lane"),
      `Expected missing to include "D_Lane", got: ${JSON.stringify(result.missing)}`
    );
    assert.ok(
      result.missing.includes("S_Lane"),
      `Expected missing to include "S_Lane", got: ${JSON.stringify(result.missing)}`
    );
  });
});

// ---------------------------------------------------------------------------
// matchParticipants
// ---------------------------------------------------------------------------

/**
 * Creates a mock query function that simulates:
 *   SELECT pid, first_name, last_name, email, tnmt_id
 *   FROM people WHERE pid IN (?, ?, ...)
 *
 * @param {Array<{pid: string, first_name: string, last_name: string, email: string, tnmt_id: string}>} knownPeople
 * @returns {Function} async (sql, params) => { rows }
 */
const createMockQuery = (knownPeople) => {
  return async (sql, params) => {
    const rows = knownPeople.filter((p) => params.includes(String(p.pid)));
    return { rows };
  };
};

/** Helper to build a CSV row object matching parseCSV() output shape. */
const csvRow = (overrides = {}) => ({
  PID: "100",
  Email: "test@example.com",
  FirstName: "Test",
  LastName: "User",
  Team_Name: "Test Team",
  T_Lane: "10",
  D_Lane: "20",
  S_Lane: "30",
  ...overrides,
});

describe("matchParticipants", () => {
  it("Given CSV rows with PIDs that exist in DB, when matched, then all appear in matched array with correct lane values", async () => {
    // Arrange
    const mockQuery = createMockQuery([
      { pid: "100", first_name: "Alice", last_name: "Smith", email: "alice@example.com", tnmt_id: "T1" },
      { pid: "200", first_name: "Bob", last_name: "Jones", email: "bob@example.com", tnmt_id: "T1" },
    ]);
    const rows = [
      csvRow({ PID: "100", FirstName: "Alice", LastName: "Smith", T_Lane: "27", D_Lane: "1", S_Lane: "37" }),
      csvRow({ PID: "200", FirstName: "Bob", LastName: "Jones", T_Lane: "14", D_Lane: "8", S_Lane: "22" }),
    ];

    // Act
    const result = await matchParticipants(rows, mockQuery);

    // Assert
    assert.strictEqual(result.matched.length, 2, "Expected 2 matched participants");
    assert.strictEqual(result.unmatched.length, 0, "Expected 0 unmatched participants");

    const alice = result.matched.find((m) => m.pid === "100");
    assert.ok(alice, "Expected to find matched participant with PID 100");
    assert.deepStrictEqual(alice.lanes, { team: "27", doubles: "1", singles: "37" });

    const bob = result.matched.find((m) => m.pid === "200");
    assert.ok(bob, "Expected to find matched participant with PID 200");
    assert.deepStrictEqual(bob.lanes, { team: "14", doubles: "8", singles: "22" });
  });

  it('Given CSV row with PID not in DB, when matched, then appears in unmatched with reason "PID not found"', async () => {
    // Arrange
    const mockQuery = createMockQuery([]);
    const rows = [csvRow({ PID: "999", FirstName: "Ghost", LastName: "Player" })];

    // Act
    const result = await matchParticipants(rows, mockQuery);

    // Assert
    assert.strictEqual(result.matched.length, 0, "Expected 0 matched");
    assert.strictEqual(result.unmatched.length, 1, "Expected 1 unmatched");
    assert.strictEqual(result.unmatched[0].pid, "999");
    assert.strictEqual(result.unmatched[0].reason, "PID not found");
  });

  it('Given CSV row with empty PID, when matched, then appears in unmatched with reason "Missing PID"', async () => {
    // Arrange
    const mockQuery = createMockQuery([]);
    const rows = [csvRow({ PID: "" })];

    // Act
    const result = await matchParticipants(rows, mockQuery);

    // Assert
    assert.strictEqual(result.matched.length, 0, "Expected 0 matched");
    assert.strictEqual(result.unmatched.length, 1, "Expected 1 unmatched");
    assert.strictEqual(result.unmatched[0].reason, "Missing PID");
  });

  it('Given CSV row with whitespace-only PID, when matched, then appears in unmatched with reason "Missing PID"', async () => {
    // Arrange
    const mockQuery = createMockQuery([]);
    const rows = [csvRow({ PID: "   " })];

    // Act
    const result = await matchParticipants(rows, mockQuery);

    // Assert
    assert.strictEqual(result.matched.length, 0, "Expected 0 matched");
    assert.strictEqual(result.unmatched.length, 1, "Expected 1 unmatched");
    assert.strictEqual(result.unmatched[0].reason, "Missing PID");
  });

  it("Given mix of matched and unmatched rows, when matched, then counts are correct", async () => {
    // Arrange
    const mockQuery = createMockQuery([
      { pid: "100", first_name: "Alice", last_name: "Smith", email: "alice@example.com", tnmt_id: "T1" },
    ]);
    const rows = [
      csvRow({ PID: "100", FirstName: "Alice", LastName: "Smith" }),
      csvRow({ PID: "999", FirstName: "Ghost", LastName: "Player" }),
      csvRow({ PID: "", FirstName: "No", LastName: "PID" }),
    ];

    // Act
    const result = await matchParticipants(rows, mockQuery);

    // Assert
    assert.strictEqual(result.matched.length, 1, "Expected 1 matched");
    assert.strictEqual(result.unmatched.length, 2, "Expected 2 unmatched");
  });

  it("Given duplicate PID rows, when matched, then the last row is used and duplicate is reported", async () => {
    const mockQuery = createMockQuery([
      { pid: "100", first_name: "Alice", last_name: "Smith", email: "alice@example.com", tnmt_id: "T1" },
    ]);
    const rows = [
      csvRow({ PID: "100", T_Lane: "1", D_Lane: "2", S_Lane: "3" }),
      csvRow({ PID: "100", T_Lane: "11", D_Lane: "12", S_Lane: "13" }),
    ];

    const result = await matchParticipants(rows, mockQuery);

    assert.strictEqual(result.matched.length, 1, "Expected one matched participant for duplicate PID");
    assert.deepStrictEqual(result.matched[0].lanes, {
      team: "11",
      doubles: "12",
      singles: "13",
    });
    assert.ok(
      result.unmatched.some((row) => row.reason.includes("Duplicate PID")),
      "Expected duplicate PID warning in unmatched results"
    );
    assert.ok(
      result.unmatched.some((row) => row.reason.includes("earlier occurrence skipped")),
      "Expected duplicate PID reason to clarify earlier row is skipped"
    );
  });

  it('Given CSV row with "#N/A" lane values, when matched, then lane values are null', async () => {
    // Arrange
    const mockQuery = createMockQuery([
      { pid: "100", first_name: "Alice", last_name: "Smith", email: "alice@example.com", tnmt_id: "T1" },
    ]);
    const rows = [
      csvRow({ PID: "100", FirstName: "Alice", LastName: "Smith", T_Lane: "#N/A", D_Lane: "#N/A", S_Lane: "5" }),
    ];

    // Act
    const result = await matchParticipants(rows, mockQuery);

    // Assert
    assert.strictEqual(result.matched.length, 1, "Expected 1 matched");
    const alice = result.matched[0];
    assert.deepStrictEqual(alice.lanes, { team: null, doubles: null, singles: "5" });
  });
});

// ---------------------------------------------------------------------------
// importLanes
// ---------------------------------------------------------------------------

/**
 * Creates a mock query function that handles:
 *   - SELECT from scores: returns configurable current lanes per PID
 *   - INSERT INTO scores: records upsert calls
 *   - INSERT INTO audit_logs: records audit calls
 *
 * @param {Object} currentLanes - Map of PID to { team, doubles, singles } lane values
 * @returns {{ mockQuery: Function, calls: Array<{ sql: string, params: Array }> }}
 */
const createImportMockQuery = (currentLanes = {}) => {
  const calls = [];
  const mockQuery = async (sql, params) => {
    calls.push({ sql, params });

    if (sql.includes("SELECT") && sql.includes("scores")) {
      // Return current lanes for all requested PIDs
      const rows = [];
      for (const pid of params) {
        const lanes = currentLanes[pid] || {};
        if (lanes.team !== undefined) rows.push({ pid, event_type: "team", lane: lanes.team });
        if (lanes.doubles !== undefined) rows.push({ pid, event_type: "doubles", lane: lanes.doubles });
        if (lanes.singles !== undefined) rows.push({ pid, event_type: "singles", lane: lanes.singles });
      }
      return { rows };
    }
    return { rows: [] };
  };
  return { mockQuery, calls };
};

/** Helper to build a matched participant object (output shape of matchParticipants). */
const matchedRow = (overrides = {}) => ({
  pid: "100",
  firstName: "Alice",
  lastName: "Smith",
  teamName: "Team A",
  lanes: { team: "27", doubles: "1", singles: "37" },
  ...overrides,
});

describe("importLanes", () => {
  it("Given matched rows with new lane values, when imported, then returns updated count", async () => {
    // Arrange — no existing lanes in DB
    const { mockQuery } = createImportMockQuery({});
    const matched = [matchedRow()];

    // Act
    const result = await importLanes(matched, "admin@example.com", mockQuery);

    // Assert
    assert.strictEqual(result.updated, 1, "Expected 1 participant updated");
  });

  it("Given matched rows with new lane values, when imported, then lane upsert SQL executed for each event type", async () => {
    // Arrange — no existing lanes in DB
    const { mockQuery, calls } = createImportMockQuery({});
    const matched = [matchedRow()];

    // Act
    await importLanes(matched, "admin@example.com", mockQuery);

    // Assert — 3 INSERT INTO scores calls (one per event type: team, doubles, singles)
    const upsertCalls = calls.filter(
      (c) => c.sql.includes("INSERT") && c.sql.includes("scores")
    );
    assert.strictEqual(
      upsertCalls.length,
      3,
      `Expected 3 lane upsert calls, got ${upsertCalls.length}`
    );
    for (const call of upsertCalls) {
      assert.ok(
        call.sql.includes("ON DUPLICATE KEY UPDATE"),
        "Upsert SQL must use ON DUPLICATE KEY UPDATE"
      );
      assert.ok(
        call.sql.includes("lane"),
        "Upsert SQL must reference lane column"
      );
    }

    const scoreSelectCalls = calls.filter(
      (c) => c.sql.includes("SELECT pid, event_type, lane FROM scores WHERE pid IN")
    );
    assert.strictEqual(
      scoreSelectCalls.length,
      1,
      "Expected one batched scores lookup query"
    );
  });

  it("Given matched rows with new lane values, when imported, then audit entries written", async () => {
    // Arrange — no existing lanes in DB
    const { mockQuery, calls } = createImportMockQuery({});
    const matched = [matchedRow()];

    // Act
    await importLanes(matched, "admin@example.com", mockQuery);

    // Assert — audit log entries for each changed lane
    const auditCalls = calls.filter((c) => {
      const normalizedSql = c.sql.toLowerCase();
      return normalizedSql.includes("insert") && normalizedSql.includes("audit_logs");
    });
    assert.strictEqual(auditCalls.length, 1, "Expected one batched audit log INSERT");
    // Verify audit params include admin email and PID
    for (const call of auditCalls) {
      assert.ok(
        call.params.includes("admin@example.com"),
        "Audit entry must include admin email"
      );
      assert.ok(
        call.params.includes("100"),
        "Audit entry must include participant PID"
      );
    }
  });

  it("Given matched row where lane matches existing DB value, when imported, then no audit entry for unchanged lane", async () => {
    // Arrange — existing lanes match new lanes exactly
    const { mockQuery, calls } = createImportMockQuery({
      "100": { team: "27", doubles: "1", singles: "37" },
    });
    const matched = [matchedRow({ lanes: { team: "27", doubles: "1", singles: "37" } })];

    // Act
    const result = await importLanes(matched, "admin@example.com", mockQuery);

    // Assert
    assert.strictEqual(result.skipped, 1, "Expected 1 participant skipped (no changes)");
    assert.strictEqual(result.updated, 0, "Expected 0 participants updated");

    const auditCalls = calls.filter((c) => {
      const normalizedSql = c.sql.toLowerCase();
      return normalizedSql.includes("insert") && normalizedSql.includes("audit_logs");
    });
    assert.strictEqual(
      auditCalls.length,
      0,
      "Expected no audit log entries when lanes are unchanged"
    );
  });

  it("Given matched row with partial lane changes, when imported, then only changed lanes produce audit entries", async () => {
    // Arrange — only doubles differs (team and singles match)
    const { mockQuery, calls } = createImportMockQuery({
      "100": { team: "27", doubles: "1", singles: "37" },
    });
    const matched = [matchedRow({ lanes: { team: "27", doubles: "5", singles: "37" } })];

    // Act
    const result = await importLanes(matched, "admin@example.com", mockQuery);

    // Assert
    assert.strictEqual(result.updated, 1, "Expected 1 participant updated (partial change)");

    const auditCalls = calls.filter((c) => {
      const normalizedSql = c.sql.toLowerCase();
      return normalizedSql.includes("insert") && normalizedSql.includes("audit_logs");
    });
    assert.strictEqual(
      auditCalls.length,
      1,
      "Expected exactly 1 audit entry (only doubles changed)"
    );

    // The audit entry should reference the doubles lane change
    const auditParams = auditCalls[0].params;
    const paramsString = JSON.stringify(auditParams);
    assert.ok(
      paramsString.includes("1") && paramsString.includes("5"),
      "Audit entry must include old value '1' and new value '5'"
    );
  });

  it("Given multiple matched rows, when imported, then all are processed and counts are correct", async () => {
    // Arrange — PID 100 has no existing lanes (will update), PID 200 matches exactly (will skip)
    const { mockQuery } = createImportMockQuery({
      "200": { team: "14", doubles: "8", singles: "22" },
    });
    const matched = [
      matchedRow({ pid: "100", firstName: "Alice", lastName: "Smith", lanes: { team: "27", doubles: "1", singles: "37" } }),
      matchedRow({ pid: "200", firstName: "Bob", lastName: "Jones", lanes: { team: "14", doubles: "8", singles: "22" } }),
    ];

    // Act
    const result = await importLanes(matched, "admin@example.com", mockQuery);

    // Assert
    assert.strictEqual(result.updated, 1, "Expected 1 participant updated (PID 100)");
    assert.strictEqual(result.skipped, 1, "Expected 1 participant skipped (PID 200)");
  });
});
