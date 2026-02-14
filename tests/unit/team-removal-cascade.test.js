import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// applyParticipantUpdates — clearing team must cascade to doubles_pairs cleanup
// ---------------------------------------------------------------------------

describe("team removal cascade", () => {
  it("Given a participant with a team and doubles pairing, when team is cleared, then doubles_pairs rows for this participant are deleted", async () => {
    const { applyParticipantUpdates } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const calls = [];
    const mockQuery = async (sql, params) => {
      calls.push({ sql: sql.trim(), params });
      return { rows: [] };
    };

    // Simulate clearing team: tnmtId is empty, doublesId is empty
    const updates = {
      firstName: "Allister",
      lastName: "Fong",
      nickname: "",
      email: "allister@example.com",
      phone: "555-333-4444",
      birthMonth: null,
      birthDay: null,
      city: "",
      region: "",
      country: "",
      team: { tnmtId: "", name: "" },
      doubles: { did: "", partnerPid: "" },
      lanes: { team: "", doubles: "", singles: "" },
      averages: { entering: null },
      scores: { team: [], doubles: [], singles: [] },
    };

    await applyParticipantUpdates({
      pid: "1836",
      updates,
      isParticipantOnly: false,
      query: mockQuery,
    });

    // Find DELETE calls for doubles_pairs
    const doublesPairDeletes = calls.filter(
      (c) =>
        c.sql.toLowerCase().includes("delete") &&
        c.sql.toLowerCase().includes("doubles_pairs")
    );

    // Must delete all doubles_pairs rows where this participant is the owner
    assert.ok(
      doublesPairDeletes.length >= 1,
      "Clearing team must delete all doubles_pairs rows for this participant"
    );

    // The DELETE must target pid = participant's pid
    const ownerDelete = doublesPairDeletes.find((c) =>
      c.params?.includes("1836")
    );
    assert.ok(
      ownerDelete,
      "DELETE must target pid = '1836' (the participant being removed from team)"
    );
  });

  it("Given a participant with a team and doubles pairing, when team is cleared, then partner's doubles_pairs partner_pid referencing this participant is also cleared", async () => {
    const { applyParticipantUpdates } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const calls = [];
    const mockQuery = async (sql, params) => {
      calls.push({ sql: sql.trim(), params });
      return { rows: [] };
    };

    const updates = {
      firstName: "Allister",
      lastName: "Fong",
      nickname: "",
      email: "allister@example.com",
      phone: "555-333-4444",
      birthMonth: null,
      birthDay: null,
      city: "",
      region: "",
      country: "",
      team: { tnmtId: "", name: "" },
      doubles: { did: "", partnerPid: "" },
      lanes: { team: "", doubles: "", singles: "" },
      averages: { entering: null },
      scores: { team: [], doubles: [], singles: [] },
    };

    await applyParticipantUpdates({
      pid: "1836",
      updates,
      isParticipantOnly: false,
      query: mockQuery,
    });

    // Find UPDATE calls that clear partner_pid references to this participant
    const partnerClears = calls.filter(
      (c) =>
        c.sql.toLowerCase().includes("doubles_pairs") &&
        c.sql.toLowerCase().includes("partner_pid") &&
        (c.sql.toLowerCase().includes("update") ||
          c.sql.toLowerCase().includes("set"))
    );

    assert.ok(
      partnerClears.length >= 1,
      "Clearing team must also clear partner_pid references to this participant in other people's doubles_pairs rows"
    );

    // The UPDATE must reference this participant's pid
    const refClear = partnerClears.find((c) => c.params?.includes("1836"));
    assert.ok(
      refClear,
      "UPDATE must target partner_pid = '1836' in other doubles_pairs rows"
    );
  });

  it("Given a participant with doubles but NO team change (team remains), when saved, then doubles_pairs are NOT deleted", async () => {
    const { applyParticipantUpdates } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const calls = [];
    const mockQuery = async (sql, params) => {
      calls.push({ sql: sql.trim(), params });
      return { rows: [] };
    };

    // Simulate saving with team intact and doubles intact
    const updates = {
      firstName: "Allister",
      lastName: "Fong",
      nickname: "",
      email: "allister@example.com",
      phone: "555-333-4444",
      birthMonth: null,
      birthDay: null,
      city: "",
      region: "",
      country: "",
      team: { tnmtId: "T1", name: "Test Team" },
      doubles: { did: "3219", partnerPid: "3768" },
      lanes: { team: "", doubles: "", singles: "" },
      averages: { entering: null },
      scores: { team: [], doubles: [], singles: [] },
    };

    await applyParticipantUpdates({
      pid: "1836",
      updates,
      isParticipantOnly: false,
      query: mockQuery,
    });

    // The upsertDoublesPair DELETE only removes stale entries (did <> current did)
    // It should NOT delete the current doubles_pairs entry
    const deleteAllDoublesPairs = calls.filter(
      (c) =>
        c.sql.toLowerCase().includes("delete") &&
        c.sql.toLowerCase().includes("doubles_pairs") &&
        c.sql.toLowerCase().includes("pid = ?") &&
        !c.sql.toLowerCase().includes("did <>")
    );

    assert.equal(
      deleteAllDoublesPairs.length,
      0,
      "When team is not cleared, must NOT delete all doubles_pairs rows (only stale ones with different did)"
    );
  });
});
