import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTICIPANT_DB_PATH = path.join(
  __dirname,
  "../../src/utils/portal/participant-db.js"
);
const src = fs.readFileSync(PARTICIPANT_DB_PATH, "utf-8");

// ---------------------------------------------------------------------------
// formatParticipant — doubles_pairs JOIN must use did, not pid
// ---------------------------------------------------------------------------

describe("formatParticipant doubles JOIN", () => {
  it("Given formatParticipant SQL, when joining doubles_pairs, then it joins on did (not pid) to avoid stale rows", () => {
    // The JOIN must be on p.did = dp.did, NOT p.pid = dp.pid
    // Joining on pid returns multiple rows when stale doubles_pairs entries exist,
    // causing LIMIT 1 to pick the wrong (oldest) partner.
    assert.ok(
      src.includes("dp ON p.did = dp.did"),
      "doubles_pairs JOIN must use p.did = dp.did to match the participant's current pairing"
    );
    assert.ok(
      !src.includes("dp ON p.pid = dp.pid"),
      "doubles_pairs JOIN must NOT use p.pid = dp.pid (returns stale rows)"
    );
  });

  it("Given a participant with multiple doubles_pairs rows, when formatParticipant runs, then it returns the current partner (matching did)", async () => {
    const { formatParticipant } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const mockQuery = async (sql) => {
      const trimmed = sql.trim().toLowerCase();

      if (trimmed.includes("from people")) {
        // Simulates JOIN result where p.did = dp.did matches the correct row
        // (did=3768, partner Peter Thomas), not the stale one (did=1836, Allister Fong)
        return {
          rows: [
            {
              pid: "3219",
              first_name: "Alexandre",
              last_name: "Dohrmann",
              nickname: null,
              email: "alex@example.com",
              phone: "555-111-2222",
              birth_month: null,
              birth_day: null,
              city: null,
              region: null,
              country: null,
              tnmt_id: "T1",
              did: "3768",
              team_tnmt_id: "T1",
              team_name: "Test Team",
              team_slug: "test-team",
              doubles_did: "3768",
              partner_pid: "3768",
              doubles_partner_first_name: "Peter",
              doubles_partner_last_name: "Thomas",
              partner1_pid: "3768",
              partner1_first_name: "Peter",
              partner1_last_name: "Thomas",
              partner1_nickname: null,
              partner2_pid: null,
              partner2_first_name: null,
              partner2_last_name: null,
              partner2_nickname: null,
            },
          ],
        };
      }

      if (trimmed.includes("from scores")) {
        return { rows: [] };
      }

      return { rows: [] };
    };

    const result = await formatParticipant("3219", mockQuery);

    assert.equal(result.doubles.partnerPid, "3768", "Must show current partner, not stale one");
    assert.equal(result.doubles.partnerName, "Peter Thomas", "Must show current partner name");
    assert.equal(result.doubles.did, "3768", "Must show current doubles ID");
  });
});

// ---------------------------------------------------------------------------
// upsertDoublesPair — must remove stale entries before upserting
// ---------------------------------------------------------------------------

describe("upsertDoublesPair stale entry cleanup", () => {
  it("Given upsertDoublesPair source, when inspected, then it deletes stale doubles_pairs rows before upserting", () => {
    assert.ok(
      src.includes("DELETE FROM doubles_pairs WHERE pid = ? AND did <> ?"),
      "upsertDoublesPair must delete stale doubles_pairs entries for the participant before upserting"
    );
  });

  it("Given a participant changing partners, when upsertDoublesPair runs, then it deletes old entry and upserts new one", async () => {
    const { applyParticipantUpdates } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const calls = [];
    const mockQuery = async (sql, params) => {
      calls.push({ sql: sql.trim(), params });
      return { rows: [] };
    };

    const updates = {
      firstName: "Alexandre",
      lastName: "Dohrmann",
      nickname: "",
      email: "alex@example.com",
      phone: "555-111-2222",
      birthMonth: null,
      birthDay: null,
      city: "",
      region: "",
      country: "",
      team: { tnmtId: "T1", name: "Test Team" },
      doubles: { did: "3768", partnerPid: "3768" },
      lanes: { team: "", doubles: "", singles: "" },
      averages: { entering: null },
      scores: { team: [], doubles: [], singles: [] },
    };

    await applyParticipantUpdates({
      pid: "3219",
      updates,
      isParticipantOnly: false,
      query: mockQuery,
    });

    // Find the DELETE call that removes stale doubles_pairs
    const deleteCalls = calls.filter(
      (c) => c.sql.toLowerCase().includes("delete") && c.sql.toLowerCase().includes("doubles_pairs")
    );
    assert.strictEqual(
      deleteCalls.length,
      1,
      "Must issue exactly one DELETE to clean up stale doubles_pairs"
    );
    assert.deepStrictEqual(
      deleteCalls[0].params,
      ["3219", "3768"],
      "DELETE must target pid=3219 and exclude the current did=3768"
    );

    // Find the INSERT/upsert call for doubles_pairs
    const upsertCalls = calls.filter(
      (c) => c.sql.toLowerCase().includes("insert") && c.sql.toLowerCase().includes("doubles_pairs")
    );
    assert.strictEqual(
      upsertCalls.length,
      1,
      "Must issue exactly one INSERT/upsert for doubles_pairs"
    );

    // DELETE must come before INSERT
    const deleteIndex = calls.indexOf(deleteCalls[0]);
    const upsertIndex = calls.indexOf(upsertCalls[0]);
    assert.ok(
      deleteIndex < upsertIndex,
      "DELETE must execute before INSERT to clean up stale rows first"
    );
  });
});

// ---------------------------------------------------------------------------
// formatParticipant — cleared partner_pid must not reappear via partner2 fallback
// ---------------------------------------------------------------------------

describe("formatParticipant cleared partner persistence", () => {
  // Helper: build mock row for a participant with cleared partner_pid but stale data lingering
  const buildClearedPartnerRow = ({
    doublesPartnerFirstName = null,
    doublesPartnerLastName = null,
  } = {}) => ({
    pid: "1836",
    first_name: "Allister",
    last_name: "Fong",
    nickname: null,
    email: "allister@example.com",
    phone: "555-333-4444",
    birth_month: null,
    birth_day: null,
    city: null,
    region: null,
    country: null,
    tnmt_id: "T1",
    did: "3219",
    team_tnmt_id: "T1",
    team_name: "Test Team",
    team_slug: "test-team",
    // doubles_pairs entry EXISTS but partner_pid is null (cleared by user)
    doubles_did: "3219",
    partner_pid: null,
    doubles_partner_first_name: doublesPartnerFirstName,
    doubles_partner_last_name: doublesPartnerLastName,
    // partner1: no match (partner_pid is null)
    partner1_pid: null,
    partner1_first_name: null,
    partner1_last_name: null,
    partner1_nickname: null,
    // partner2: fallback finds pid 3768 who shares did=3219
    partner2_pid: "3768",
    partner2_first_name: "Peter",
    partner2_last_name: "Thomas",
    partner2_nickname: null,
  });

  const buildMockQuery = (personRow) => async (sql) => {
    const trimmed = sql.trim().toLowerCase();
    if (trimmed.includes("from people")) return { rows: [personRow] };
    if (trimmed.includes("from scores")) return { rows: [] };
    return { rows: [] };
  };

  it("Given a doubles_pairs entry with partner_pid cleared to null, when formatParticipant runs, then partnerPid is empty (not filled by partner2 fallback)", async () => {
    const { formatParticipant } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const result = await formatParticipant(
      "1836",
      buildMockQuery(buildClearedPartnerRow())
    );

    // The doubles_pairs entry exists with partner_pid=null — this is authoritative.
    // The partner2 fallback (via shared did) must NOT override the cleared partner.
    assert.equal(
      result.doubles.partnerPid,
      "",
      "Cleared partner_pid must remain empty — partner2 fallback must not override it"
    );
    assert.equal(
      result.doubles.partnerName,
      "",
      "Cleared partner must show empty name — partner2 fallback must not override it"
    );
  });

  it("Given a cleared partner_pid but stale partner_first_name/partner_last_name in doubles_pairs, when formatParticipant runs, then partnerName is empty (stale names ignored)", async () => {
    const { formatParticipant } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    // Simulate: partner_pid was cleared but doubles_pairs still has name fields
    // from the original XML import (these are NOT cleared by upsertDoublesPair)
    const row = buildClearedPartnerRow({
      doublesPartnerFirstName: "Alexandre",
      doublesPartnerLastName: "Dohrmann",
    });
    const result = await formatParticipant("1836", buildMockQuery(row));

    assert.equal(
      result.doubles.partnerPid,
      "",
      "Cleared partner_pid must remain empty"
    );
    assert.equal(
      result.doubles.partnerName,
      "",
      "Stale partner_first_name/partner_last_name in doubles_pairs must be ignored when partner_pid is null"
    );
  });
});
