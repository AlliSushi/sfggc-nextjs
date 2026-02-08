import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { writeAuditEntries } from "../../../src/utils/portal/audit.js";

/**
 * Tests that writeAuditEntries and the participant-db functions accept an
 * optional `query` parameter and route all SQL through it instead of the
 * default pool query.
 */

/* ------------------------------------------------------------------ */
/*  Shared mock helpers                                               */
/* ------------------------------------------------------------------ */

const buildMockQuery = () => {
  const calls = [];
  const mockQuery = async (sql, params = []) => {
    calls.push({ sql: sql.trim(), params });
    return { rows: [] };
  };
  mockQuery.calls = calls;
  return mockQuery;
};

/* ------------------------------------------------------------------ */
/*  writeAuditEntries - query parameter threading                     */
/* ------------------------------------------------------------------ */

test(
  "Given changes and a custom query, when writeAuditEntries is called, then it uses the custom query",
  async () => {
    // Arrange
    const mockQuery = buildMockQuery();
    const changes = [
      { field: "email", oldValue: "old@example.com", newValue: "new@example.com" },
    ];

    // Act
    await writeAuditEntries("admin@example.com", "3336", changes, mockQuery);

    // Assert
    assert.equal(mockQuery.calls.length, 1);
    assert.ok(
      mockQuery.calls[0].sql.includes("insert into audit_logs"),
      "SQL must target audit_logs table"
    );
    assert.ok(
      mockQuery.calls[0].params.includes("admin@example.com"),
      "Admin email must be in params"
    );
    assert.ok(
      mockQuery.calls[0].params.includes("3336"),
      "PID must be in params"
    );
  }
);

test(
  "Given multiple changes and a custom query, when writeAuditEntries is called, then all entries are batched in one query",
  async () => {
    // Arrange
    const mockQuery = buildMockQuery();
    const changes = [
      { field: "email", oldValue: "old@example.com", newValue: "new@example.com" },
      { field: "phone", oldValue: "555-111-2222", newValue: "555-333-4444" },
      { field: "city", oldValue: "Oakland", newValue: "San Francisco" },
    ];

    // Act
    await writeAuditEntries("admin@example.com", "3336", changes, mockQuery);

    // Assert - single batched insert
    assert.equal(mockQuery.calls.length, 1);
    // 6 params per entry (id, admin_email, pid, field, old_value, new_value) x 3 entries = 18
    assert.equal(mockQuery.calls[0].params.length, 18);
  }
);

test(
  "Given no changes and a custom query, when writeAuditEntries is called, then the query is not invoked",
  async () => {
    // Arrange
    const mockQuery = buildMockQuery();

    // Act
    await writeAuditEntries("admin@example.com", "3336", [], mockQuery);

    // Assert
    assert.equal(mockQuery.calls.length, 0, "No SQL should execute when there are no changes");
  }
);

test(
  "Given array values in changes, when writeAuditEntries uses custom query, then values are JSON-stringified",
  async () => {
    // Arrange
    const mockQuery = buildMockQuery();
    const changes = [
      { field: "scores_team", oldValue: [100, 120, 130], newValue: [150, 160, 170] },
    ];

    // Act
    await writeAuditEntries("admin@example.com", "3336", changes, mockQuery);

    // Assert
    assert.equal(mockQuery.calls.length, 1);
    const params = mockQuery.calls[0].params;
    // old_value should be JSON-stringified array
    assert.ok(params.some((p) => typeof p === "string" && p.includes("100")));
    // new_value should be JSON-stringified array
    assert.ok(params.some((p) => typeof p === "string" && p.includes("150")));
  }
);

/* ------------------------------------------------------------------ */
/*  formatParticipant - read-path query parameter threading            */
/* ------------------------------------------------------------------ */

test(
  "Given a participant with team data, when formatParticipant is called with a custom query, then all reads use it",
  async () => {
    const { formatParticipant } = await import(
      "../../../src/utils/portal/participant-db.js"
    );

    const calls = [];
    const mockQuery = async (sql, params = []) => {
      const trimmed = sql.trim();
      calls.push(trimmed.slice(0, 60));
      if (trimmed.startsWith("select * from people")) {
        return {
          rows: [
            {
              pid: "3336",
              first_name: "Robert",
              last_name: "Aldeguer",
              email: "robert@example.com",
              phone: "555-555-5555",
              birth_month: 1,
              birth_day: 1,
              city: "San Francisco",
              region: "CA",
              country: "US",
              tnmt_id: "2305",
              did: "1076",
            },
          ],
        };
      }
      if (trimmed.startsWith("select * from teams")) {
        return { rows: [{ team_name: "Well, No Split!", slug: "well-no-split" }] };
      }
      return { rows: [] };
    };

    const result = await formatParticipant("3336", mockQuery);

    assert.ok(result, "formatParticipant should return a participant object");
    assert.equal(result.pid, "3336");
    assert.equal(result.firstName, "Robert");
    assert.ok(calls.length >= 4, `Expected at least 4 queries but got ${calls.length}`);
    assert.ok(calls.some((sql) => sql.includes("select * from people")));
    assert.ok(calls.some((sql) => sql.includes("select * from teams")));
    assert.ok(calls.some((sql) => sql.includes("select * from doubles_pairs")));
    assert.ok(calls.some((sql) => sql.includes("select * from scores")));
  }
);

test(
  "Given a participant not found, when formatParticipant is called with a custom query, then it returns null",
  async () => {
    const { formatParticipant } = await import(
      "../../../src/utils/portal/participant-db.js"
    );

    const mockQuery = async () => ({ rows: [] });

    const result = await formatParticipant("nonexistent", mockQuery);

    assert.equal(result, null);
  }
);

test(
  "Given a participant with a doubles partner_pid, when formatParticipant resolves partner, then the partner lookup uses the custom query",
  async () => {
    const { formatParticipant } = await import(
      "../../../src/utils/portal/participant-db.js"
    );

    const calls = [];
    const mockQuery = async (sql, params = []) => {
      const trimmed = sql.trim();
      calls.push({ sql: trimmed.slice(0, 60), params });
      if (trimmed.startsWith("select * from people where pid") && params[0] === "3336") {
        return {
          rows: [
            {
              pid: "3336",
              first_name: "Robert",
              last_name: "Aldeguer",
              email: "robert@example.com",
              phone: "555-555-5555",
              birth_month: 1,
              birth_day: 1,
              city: "San Francisco",
              region: "CA",
              country: "US",
              tnmt_id: null,
              did: "1076",
            },
          ],
        };
      }
      if (trimmed.startsWith("select * from doubles_pairs")) {
        return { rows: [{ did: "1076", pid: "3336", partner_pid: "1076" }] };
      }
      if (trimmed.startsWith("select * from people") && params[0] === "1076") {
        return {
          rows: [{ pid: "1076", first_name: "Dan", last_name: "Fahy" }],
        };
      }
      return { rows: [] };
    };

    const result = await formatParticipant("3336", mockQuery);

    assert.equal(result.doubles.partnerPid, "1076");
    assert.equal(result.doubles.partnerName, "Dan Fahy");
    // The partner lookup should have gone through our mock
    assert.ok(
      calls.some((c) => c.sql.includes("select * from people") && c.params[0] === "1076"),
      "Partner lookup must use the custom query"
    );
  }
);

/* ------------------------------------------------------------------ */
/*  participant-db functions - query parameter signature verification  */
/* ------------------------------------------------------------------ */

test(
  "Given applyParticipantUpdates, when called with a query option, then it threads query to sub-functions",
  async () => {
    const { applyParticipantUpdates } = await import(
      "../../../src/utils/portal/participant-db.js"
    );

    const calls = [];
    const mockQuery = async (sql, params = []) => {
      calls.push({ sql: sql.trim().slice(0, 50), params });
      return { rows: [] };
    };

    // Act - call with minimal valid updates and mock query
    await applyParticipantUpdates({
      pid: "9999",
      updates: {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        phone: "555-000-0000",
        birthMonth: 1,
        birthDay: 1,
        city: "Test",
        region: "CA",
        country: "US",
        team: null,
        doubles: null,
        lanes: {},
        averages: {},
        scores: {},
      },
      isParticipantOnly: true,
      query: mockQuery,
    });

    // Assert - at minimum upsertPerson should have been called with our mock
    assert.ok(calls.length >= 1, "At least one query must be made through the custom query");
    assert.ok(
      calls[0].sql.includes("insert into people"),
      "First query should be the people upsert"
    );
  }
);

test(
  "Given applyParticipantUpdates with admin updates, when called with mock query, then team/doubles/scores also use it",
  async () => {
    const { applyParticipantUpdates } = await import(
      "../../../src/utils/portal/participant-db.js"
    );

    const calls = [];
    const mockQuery = async (sql, params = []) => {
      calls.push(sql.trim().slice(0, 60));
      return { rows: [] };
    };

    // Act - full admin update (isParticipantOnly = false)
    await applyParticipantUpdates({
      pid: "9999",
      updates: {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        phone: "555-000-0000",
        birthMonth: 1,
        birthDay: 1,
        city: "Test",
        region: "CA",
        country: "US",
        team: { tnmtId: "100", name: "Test Team" },
        doubles: { did: "200", partnerPid: "300" },
        lanes: { team: "A", doubles: "B", singles: "C" },
        averages: { entering: 150, handicap: 10 },
        scores: { team: [100, 110, 120], doubles: [90], singles: [] },
      },
      isParticipantOnly: false,
      query: mockQuery,
    });

    // Assert - should have people insert, team insert, doubles insert, and 3 score inserts
    assert.ok(calls.length >= 6, `Expected at least 6 queries but got ${calls.length}`);
    assert.ok(calls.some((sql) => sql.includes("insert into people")));
    assert.ok(calls.some((sql) => sql.includes("insert into teams")));
    assert.ok(calls.some((sql) => sql.includes("insert into doubles_pairs")));
    assert.ok(calls.some((sql) => sql.includes("insert into scores")));
  }
);
