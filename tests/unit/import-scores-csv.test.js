import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { wouldClobberExisting } from "../../src/utils/portal/import-csv-helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_PATH = path.join(__dirname, "../../src/utils/portal/importScoresCsv.js");
const ROUTE_PATH = path.join(__dirname, "../../src/pages/api/portal/admin/import-scores.js");

// Import will fail until implementation exists — that's expected in Red phase
let mod;
try {
  mod = await import("../../src/utils/portal/importScoresCsv.js");
} catch {
  // Module doesn't exist yet; tests will fail with clear errors
  mod = {};
}

const {
  normalizeScoreValue = () => { throw new Error("not implemented"); },
  validateColumns = () => { throw new Error("not implemented"); },
  pivotRowsByBowler = () => { throw new Error("not implemented"); },
  matchParticipants = () => { throw new Error("not implemented"); },
  importScores = () => { throw new Error("not implemented"); },
  detectCsvEventType = () => { throw new Error("not implemented"); },
  REQUIRED_COLUMNS = [],
} = mod;

// ---------------------------------------------------------------------------
// normalizeScoreValue
// ---------------------------------------------------------------------------

describe("normalizeScoreValue", () => {
  it('Given "180", when normalized, then returns 180', () => {
    assert.strictEqual(normalizeScoreValue("180"), 180);
  });

  it('Given "  200  ", when normalized, then returns 200', () => {
    assert.strictEqual(normalizeScoreValue("  200  "), 200);
  });

  it('Given "", when normalized, then returns null', () => {
    assert.strictEqual(normalizeScoreValue(""), null);
  });

  it("Given null, when normalized, then returns null", () => {
    assert.strictEqual(normalizeScoreValue(null), null);
  });

  it("Given undefined, when normalized, then returns null", () => {
    assert.strictEqual(normalizeScoreValue(undefined), null);
  });

  it('Given "abc", when normalized, then returns null', () => {
    assert.strictEqual(normalizeScoreValue("abc"), null);
  });

  it('Given "0", when normalized, then returns 0', () => {
    assert.strictEqual(normalizeScoreValue("0"), 0);
  });

  it("Given numeric 215, when normalized, then returns 215", () => {
    assert.strictEqual(normalizeScoreValue(215), 215);
  });
});

// ---------------------------------------------------------------------------
// validateColumns
// ---------------------------------------------------------------------------

describe("validateColumns", () => {
  it("Given headers with all required columns, when validated, then valid is true", () => {
    const result = validateColumns([
      "Bowler name", "Scratch", "Game number", "Team name", "Lane number",
    ]);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.missing, []);
  });

  it('Given headers missing "Scratch", when validated, then valid is false with missing containing "Scratch"', () => {
    const result = validateColumns([
      "Bowler name", "Game number", "Team name", "Lane number",
    ]);
    assert.strictEqual(result.valid, false);
    assert.ok(result.missing.includes("Scratch"));
  });

  it("Given headers with extra columns beyond required, when validated, then valid is true", () => {
    const result = validateColumns([
      "Open mode", "Game name", "Bowler name", "Scratch",
      "Game number", "Team name", "Lane number", "HDCP",
    ]);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.missing, []);
  });

  it("Given empty headers array, when validated, then valid is false with all required columns missing", () => {
    const result = validateColumns([]);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.missing.length, 5);
    assert.ok(result.missing.includes("Bowler name"));
    assert.ok(result.missing.includes("Scratch"));
    assert.ok(result.missing.includes("Game number"));
    assert.ok(result.missing.includes("Team name"));
    assert.ok(result.missing.includes("Lane number"));
  });
});

// ---------------------------------------------------------------------------
// pivotRowsByBowler
// ---------------------------------------------------------------------------

/** Helper to build a CSV row matching parseCSV() output shape for score CSV. */
const scoreRow = (overrides = {}) => ({
  "Bowler name": "Ronald Hua",
  "Scratch": "189",
  "Game number": "1",
  "Team name": "Day One Crew",
  "Lane number": "9",
  ...overrides,
});

describe("pivotRowsByBowler", () => {
  it("Given 3 CSV rows for same bowler (games 1-3), when pivoted, then produces single entry with all 3 scores", () => {
    const rows = [
      scoreRow({ "Game number": "1", "Scratch": "189" }),
      scoreRow({ "Game number": "2", "Scratch": "210" }),
      scoreRow({ "Game number": "3", "Scratch": "175" }),
    ];
    const result = pivotRowsByBowler(rows);
    assert.strictEqual(result.size, 1);
    const bowler = result.get("ronald hua");
    assert.strictEqual(bowler.game1, 189);
    assert.strictEqual(bowler.game2, 210);
    assert.strictEqual(bowler.game3, 175);
  });

  it("Given 2 CSV rows for same bowler (games 1-2 only), when pivoted, then game3 is null", () => {
    const rows = [
      scoreRow({ "Game number": "1", "Scratch": "189" }),
      scoreRow({ "Game number": "2", "Scratch": "210" }),
    ];
    const result = pivotRowsByBowler(rows);
    const bowler = result.get("ronald hua");
    assert.strictEqual(bowler.game1, 189);
    assert.strictEqual(bowler.game2, 210);
    assert.strictEqual(bowler.game3, null);
  });

  it("Given 1 CSV row for a bowler (game 1 only), when pivoted, then game2 and game3 are null", () => {
    const rows = [scoreRow({ "Game number": "1", "Scratch": "189" })];
    const result = pivotRowsByBowler(rows);
    const bowler = result.get("ronald hua");
    assert.strictEqual(bowler.game1, 189);
    assert.strictEqual(bowler.game2, null);
    assert.strictEqual(bowler.game3, null);
  });

  it("Given rows for 2 different bowlers, when pivoted, then produces 2 entries", () => {
    const rows = [
      scoreRow({ "Bowler name": "Ronald Hua", "Game number": "1", "Scratch": "189" }),
      scoreRow({ "Bowler name": "Kellen Parker", "Game number": "1", "Scratch": "224" }),
    ];
    const result = pivotRowsByBowler(rows);
    assert.strictEqual(result.size, 2);
    assert.ok(result.has("ronald hua"));
    assert.ok(result.has("kellen parker"));
  });

  it("Given rows with case-different names for same bowler, when pivoted, then treated as same bowler", () => {
    const rows = [
      scoreRow({ "Bowler name": "Ronald Hua", "Game number": "1", "Scratch": "189" }),
      scoreRow({ "Bowler name": "RONALD HUA", "Game number": "2", "Scratch": "210" }),
    ];
    const result = pivotRowsByBowler(rows);
    assert.strictEqual(result.size, 1);
    const bowler = result.get("ronald hua");
    assert.strictEqual(bowler.game1, 189);
    assert.strictEqual(bowler.game2, 210);
  });

  it("Given row with empty bowler name, when pivoted, then row is skipped", () => {
    const rows = [scoreRow({ "Bowler name": "", "Game number": "1", "Scratch": "100" })];
    const result = pivotRowsByBowler(rows);
    assert.strictEqual(result.size, 0);
  });

  it("Given rows with empty Scratch column, when pivoted, then score is null", () => {
    const rows = [scoreRow({ "Game number": "1", "Scratch": "" })];
    const result = pivotRowsByBowler(rows);
    const bowler = result.get("ronald hua");
    assert.strictEqual(bowler.game1, null);
  });

  it("Given pivoted result, then preserves original name casing and CSV team/lane", () => {
    const rows = [scoreRow({ "Bowler name": "Ronald Hua", "Team name": "Day One Crew", "Lane number": "9" })];
    const result = pivotRowsByBowler(rows);
    const bowler = result.get("ronald hua");
    assert.strictEqual(bowler.name, "Ronald Hua");
    assert.strictEqual(bowler.csvTeamName, "Day One Crew");
    assert.strictEqual(bowler.csvLane, "9");
  });
});

// ---------------------------------------------------------------------------
// detectCsvEventType
// ---------------------------------------------------------------------------

describe("detectCsvEventType", () => {
  it('Given CSV rows with Game name "T1-Teams 1", when detected, then returns "team"', () => {
    const rows = [
      scoreRow({ "Game name": "2/13/ 7:00 PM  T1-Teams 1" }),
    ];
    assert.strictEqual(detectCsvEventType(rows), "team");
  });

  it('Given CSV rows with Game name "D2-Doubles 2", when detected, then returns "doubles"', () => {
    const rows = [
      scoreRow({ "Game name": "2/13/ 7:00 PM  D2-Doubles 2" }),
    ];
    assert.strictEqual(detectCsvEventType(rows), "doubles");
  });

  it('Given CSV rows with Game name "S3-Singles 3", when detected, then returns "singles"', () => {
    const rows = [
      scoreRow({ "Game name": "2/13/ 7:00 PM  S3-Singles 3" }),
    ];
    assert.strictEqual(detectCsvEventType(rows), "singles");
  });

  it("Given CSV rows with no Game name column, when detected, then returns null", () => {
    const rows = [scoreRow({ "Game name": "" })];
    assert.strictEqual(detectCsvEventType(rows), null);
  });

  it("Given empty rows array, when detected, then returns null", () => {
    assert.strictEqual(detectCsvEventType([]), null);
  });

  it('Given CSV rows with unrecognized Game name, when detected, then returns null', () => {
    const rows = [scoreRow({ "Game name": "2/13/ 7:00 PM  X1-Unknown" })];
    assert.strictEqual(detectCsvEventType(rows), null);
  });
});

// ---------------------------------------------------------------------------
// wouldClobberExisting
// ---------------------------------------------------------------------------

describe("wouldClobberExisting (scores)", () => {
  it("Given null new value and non-null old value, when checked, then returns true", () => {
    assert.strictEqual(wouldClobberExisting(null, 180), true);
  });

  it("Given null new value and null old value, when checked, then returns false", () => {
    assert.strictEqual(wouldClobberExisting(null, null), false);
  });

  it("Given non-null new value and non-null old value, when checked, then returns false", () => {
    assert.strictEqual(wouldClobberExisting(200, 180), false);
  });

  it("Given non-null new value and null old value, when checked, then returns false", () => {
    assert.strictEqual(wouldClobberExisting(200, null), false);
  });
});

// ---------------------------------------------------------------------------
// matchParticipants
// ---------------------------------------------------------------------------

/**
 * Creates a mock query that simulates:
 *   SELECT p.pid, p.first_name, p.last_name, t.team_name,
 *          s.lane, s.game1, s.game2, s.game3
 *   FROM people p LEFT JOIN teams t ... LEFT JOIN scores s ...
 *
 * @param {Array<{pid, first_name, last_name, team_name, lane?, game1?, game2?, game3?}>} dbPeople
 * @returns {Function} async (sql, params) => { rows }
 */
const createMatchMockQuery = (dbPeople = []) => {
  return async (_sql, _params) => {
    return { rows: dbPeople };
  };
};

describe("matchParticipants", () => {
  it("Given bowler name matching one person in DB, when matched, then appears in matched with pid", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Ronald", last_name: "Hua", team_name: "Day One Crew", lane: null, game1: null, game2: null, game3: null },
    ]);
    const bowlerMap = new Map([
      ["ronald hua", { name: "Ronald Hua", csvTeamName: "Day One Crew", csvLane: "9", game1: 189, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 1);
    assert.strictEqual(result.matched[0].pid, "P100");
    assert.strictEqual(result.unmatched.length, 0);
  });

  it("Given bowler name matching no one in DB, when matched, then appears in unmatched", async () => {
    const mockQuery = createMatchMockQuery([]);
    const bowlerMap = new Map([
      ["ghost player", { name: "Ghost Player", csvTeamName: "Unknown", csvLane: "1", game1: 100, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 0);
    assert.strictEqual(result.unmatched.length, 1);
    assert.ok(result.unmatched[0].reason.includes("not found"));
  });

  it("Given bowler name matching multiple DB people with different teams, when CSV team matches one, then correct person matched", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "John", last_name: "Smith", team_name: "Team Alpha", lane: null, game1: null, game2: null, game3: null },
      { pid: "P200", first_name: "John", last_name: "Smith", team_name: "Team Beta", lane: null, game1: null, game2: null, game3: null },
    ]);
    const bowlerMap = new Map([
      ["john smith", { name: "John Smith", csvTeamName: "Team Beta", csvLane: "5", game1: 200, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 1);
    assert.strictEqual(result.matched[0].pid, "P200");
  });

  it("Given bowler name matching multiple DB people and CSV team matches none, when matched, then appears in unmatched", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "John", last_name: "Smith", team_name: "Team Alpha", lane: null, game1: null, game2: null, game3: null },
      { pid: "P200", first_name: "John", last_name: "Smith", team_name: "Team Beta", lane: null, game1: null, game2: null, game3: null },
    ]);
    const bowlerMap = new Map([
      ["john smith", { name: "John Smith", csvTeamName: "Unknown Team", csvLane: "5", game1: 200, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 0);
    assert.strictEqual(result.unmatched.length, 1);
    assert.ok(result.unmatched[0].reason.includes("Multiple"));
  });

  it("Given matched bowler whose CSV team does not match DB team, when matched, then warning with type team_mismatch emitted", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Ronald", last_name: "Hua", team_name: "Day One Crew", lane: null, game1: null, game2: null, game3: null },
    ]);
    const bowlerMap = new Map([
      ["ronald hua", { name: "Ronald Hua", csvTeamName: "Wrong Team", csvLane: "9", game1: 189, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 1);
    assert.ok(result.warnings.length > 0);
    const teamWarning = result.warnings.find((w) => w.type === "team_mismatch");
    assert.ok(teamWarning, "Expected a team_mismatch warning");
  });

  it("Given matched bowler whose CSV lane does not match DB lane, when matched, then warning with type lane_mismatch emitted", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Ronald", last_name: "Hua", team_name: "Day One Crew", lane: "15", game1: null, game2: null, game3: null },
    ]);
    const bowlerMap = new Map([
      ["ronald hua", { name: "Ronald Hua", csvTeamName: "Day One Crew", csvLane: "9", game1: 189, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 1);
    const laneWarning = result.warnings.find((w) => w.type === "lane_mismatch");
    assert.ok(laneWarning, "Expected a lane_mismatch warning");
  });

  it("Given matched bowler with existing scores in DB, when matched, then existing scores included for null-preservation", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Ronald", last_name: "Hua", team_name: "Day One Crew", lane: "9", game1: 180, game2: 200, game3: 190 },
    ]);
    const bowlerMap = new Map([
      ["ronald hua", { name: "Ronald Hua", csvTeamName: "Day One Crew", csvLane: "9", game1: 189, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 1);
    assert.strictEqual(result.matched[0].existingGame1, 180);
    assert.strictEqual(result.matched[0].existingGame2, 200);
    assert.strictEqual(result.matched[0].existingGame3, 190);
  });

  it("Given CSV name matching DB nickname + last_name, when matched, then person is found", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Joseph", last_name: "Bishop", nickname: "Joe", team_name: "TG Group", lane: null, game1: null, game2: null, game3: null },
    ]);
    const bowlerMap = new Map([
      ["joe bishop", { name: "Joe Bishop", csvTeamName: "TG Group", csvLane: "5", game1: 180, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 1);
    assert.strictEqual(result.matched[0].pid, "P100");
    assert.strictEqual(result.unmatched.length, 0);
  });

  it("Given CSV name matching DB first_name when nickname also exists, when matched, then first_name match still works", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Joseph", last_name: "Bishop", nickname: "Joe", team_name: "TG Group", lane: null, game1: null, game2: null, game3: null },
    ]);
    const bowlerMap = new Map([
      ["joseph bishop", { name: "Joseph Bishop", csvTeamName: "TG Group", csvLane: "5", game1: 180, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 1);
    assert.strictEqual(result.matched[0].pid, "P100");
  });

  it("Given person with no nickname, when CSV name matches first_name, then matched normally", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Ronald", last_name: "Hua", nickname: null, team_name: "Day One Crew", lane: null, game1: null, game2: null, game3: null },
    ]);
    const bowlerMap = new Map([
      ["ronald hua", { name: "Ronald Hua", csvTeamName: "Day One Crew", csvLane: "9", game1: 189, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 1);
    assert.strictEqual(result.matched[0].pid, "P100");
  });

  it("Given nickname match produces multiple candidates, when CSV team disambiguates, then correct person matched", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Joseph", last_name: "Bishop", nickname: "Joe", team_name: "Team Alpha", lane: null, game1: null, game2: null, game3: null },
      { pid: "P200", first_name: "Joseph", last_name: "Bishop", nickname: "Joe", team_name: "Team Beta", lane: null, game1: null, game2: null, game3: null },
    ]);
    const bowlerMap = new Map([
      ["joe bishop", { name: "Joe Bishop", csvTeamName: "Team Beta", csvLane: "5", game1: 200, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 1);
    assert.strictEqual(result.matched[0].pid, "P200");
  });

  it("Given truncated CSV team name that starts-with matches DB team name, when matched, then no team_mismatch warning", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Travis", last_name: "Whitebread", team_name: "Turkin' and Twerkin'", lane: null, game1: null, game2: null, game3: null },
    ]);
    const bowlerMap = new Map([
      ["travis whitebread", { name: "Travis Whitebread", csvTeamName: "Turkin' and Twer", csvLane: "24", game1: 213, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 1);
    const teamWarning = result.warnings.find((w) => w.type === "team_mismatch");
    assert.strictEqual(teamWarning, undefined, "Should not warn when DB name starts with CSV name");
  });

  it("Given doubles event type and matched bowler with pair_size 1 (no shared did), when matched, then warning with type no_doubles_partner emitted", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Ronald", last_name: "Hua", team_name: "Day One Crew", lane: null, game1: null, game2: null, game3: null, pair_size: 1 },
    ]);
    const bowlerMap = new Map([
      ["ronald hua", { name: "Ronald Hua", csvTeamName: "Day One Crew", csvLane: "9", game1: 189, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "doubles");
    assert.strictEqual(result.matched.length, 1);
    const partnerWarning = result.warnings.find((w) => w.type === "no_doubles_partner");
    assert.ok(partnerWarning, "Expected a no_doubles_partner warning");
    assert.strictEqual(partnerWarning.pid, "P100");
  });

  it("Given doubles event type and matched bowler with no doubles_pairs row, when matched, then warning with type no_doubles_partner emitted", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Ronald", last_name: "Hua", team_name: "Day One Crew", lane: null, game1: null, game2: null, game3: null, pair_size: null },
    ]);
    const bowlerMap = new Map([
      ["ronald hua", { name: "Ronald Hua", csvTeamName: "Day One Crew", csvLane: "9", game1: 189, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "doubles");
    assert.strictEqual(result.matched.length, 1);
    const partnerWarning = result.warnings.find((w) => w.type === "no_doubles_partner");
    assert.ok(partnerWarning, "Expected a no_doubles_partner warning when pair_size is null");
  });

  it("Given doubles event type and matched bowler with pair_size 2 (properly paired), when matched, then no no_doubles_partner warning emitted", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Ronald", last_name: "Hua", team_name: "Day One Crew", lane: null, game1: null, game2: null, game3: null, pair_size: 2 },
    ]);
    const bowlerMap = new Map([
      ["ronald hua", { name: "Ronald Hua", csvTeamName: "Day One Crew", csvLane: "9", game1: 189, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "doubles");
    assert.strictEqual(result.matched.length, 1);
    const partnerWarning = result.warnings.find((w) => w.type === "no_doubles_partner");
    assert.strictEqual(partnerWarning, undefined, "Should not warn when pair_size >= 2");
  });

  it("Given team event type and matched bowler with pair_size 1, when matched, then no no_doubles_partner warning emitted", async () => {
    const mockQuery = createMatchMockQuery([
      { pid: "P100", first_name: "Ronald", last_name: "Hua", team_name: "Day One Crew", lane: null, game1: null, game2: null, game3: null, pair_size: 1 },
    ]);
    const bowlerMap = new Map([
      ["ronald hua", { name: "Ronald Hua", csvTeamName: "Day One Crew", csvLane: "9", game1: 189, game2: null, game3: null }],
    ]);

    const result = await matchParticipants(bowlerMap, mockQuery, "team");
    assert.strictEqual(result.matched.length, 1);
    const partnerWarning = result.warnings.find((w) => w.type === "no_doubles_partner");
    assert.strictEqual(partnerWarning, undefined, "Should not warn for non-doubles events");
  });
});

// ---------------------------------------------------------------------------
// importScores
// ---------------------------------------------------------------------------

/**
 * Creates a mock query for importScores that tracks all SQL calls.
 *
 * @returns {{ mockQuery: Function, calls: Array<{ sql: string, params: Array }> }}
 */
const createImportMockQuery = () => {
  const calls = [];
  const mockQuery = async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [] };
  };
  return { mockQuery, calls };
};

/** Helper to build a matched bowler object. */
const matchedBowler = (overrides = {}) => ({
  pid: "P100",
  firstName: "Ronald",
  lastName: "Hua",
  dbTeamName: "Day One Crew",
  csvTeamName: "Day One Crew",
  csvLane: "9",
  game1: 189,
  game2: 210,
  game3: 175,
  existingGame1: null,
  existingGame2: null,
  existingGame3: null,
  ...overrides,
});

describe("importScores", () => {
  it("Given matched bowlers with new scores, when imported, then returns updated count", async () => {
    const { mockQuery } = createImportMockQuery();
    const matched = [matchedBowler()];

    const result = await importScores(matched, "team", "admin@example.com", mockQuery);
    assert.strictEqual(result.updated, 1);
  });

  it("Given matched bowler where all scores match existing DB values, when imported, then skipped", async () => {
    const { mockQuery } = createImportMockQuery();
    const matched = [matchedBowler({
      game1: 189, game2: 210, game3: 175,
      existingGame1: 189, existingGame2: 210, existingGame3: 175,
    })];

    const result = await importScores(matched, "team", "admin@example.com", mockQuery);
    assert.strictEqual(result.skipped, 1);
    assert.strictEqual(result.updated, 0);
  });

  it("Given matched bowlers with new scores, when imported, then audit entries written", async () => {
    const { mockQuery, calls } = createImportMockQuery();
    const matched = [matchedBowler()];

    await importScores(matched, "team", "admin@example.com", mockQuery);

    const auditCalls = calls.filter((c) => c.sql.toLowerCase().includes("audit_logs"));
    assert.ok(auditCalls.length > 0, "Expected audit log entries");
    assert.ok(
      auditCalls[0].params.includes("admin@example.com"),
      "Audit entry must include admin email"
    );
  });

  it("Given matched bowler with unchanged scores, when imported, then no audit entry", async () => {
    const { mockQuery, calls } = createImportMockQuery();
    const matched = [matchedBowler({
      game1: 189, game2: 210, game3: 175,
      existingGame1: 189, existingGame2: 210, existingGame3: 175,
    })];

    await importScores(matched, "team", "admin@example.com", mockQuery);

    const auditCalls = calls.filter((c) => c.sql.toLowerCase().includes("audit_logs"));
    assert.strictEqual(auditCalls.length, 0, "Expected no audit entries when scores unchanged");
  });

  it("Given multiple matched bowlers, when imported, then all processed and counts are correct", async () => {
    const { mockQuery } = createImportMockQuery();
    const matched = [
      matchedBowler({ pid: "P100", game1: 189 }),
      matchedBowler({ pid: "P200", firstName: "Kellen", lastName: "Parker", game1: 224 }),
    ];

    const result = await importScores(matched, "team", "admin@example.com", mockQuery);
    assert.strictEqual(result.updated, 2);
  });
});

// ---------------------------------------------------------------------------
// importScores SQL source analysis
// ---------------------------------------------------------------------------

describe("importScores SQL source analysis", () => {
  it("Given importScores source, when inspected, then SQL uses COALESCE for game columns", () => {
    const src = fs.readFileSync(SRC_PATH, "utf-8");
    assert.ok(
      src.includes("COALESCE") && src.includes("game1"),
      "importScores SQL must use COALESCE for null-preservation on game columns"
    );
  });

  it("Given importScores source, when inspected, then SQL does NOT update lane column", () => {
    // The upsert should not have lane in the ON DUPLICATE KEY UPDATE clause
    const src = fs.readFileSync(SRC_PATH, "utf-8");
    // Find the import SQL (the INSERT INTO scores with ON DUPLICATE KEY UPDATE)
    const upsertMatch = src.match(/ON DUPLICATE KEY UPDATE[\s\S]*?(?=\`|"|$)/i);
    if (upsertMatch) {
      const updateClause = upsertMatch[0];
      // lane should not appear in the UPDATE SET assignments
      const laneInUpdate = /lane\s*=/i.test(updateClause);
      assert.strictEqual(laneInUpdate, false, "Import SQL must NOT update lane column");
    }
  });

  it("Given importScores source, when inspected, then SQL does NOT update entering_avg column", () => {
    const src = fs.readFileSync(SRC_PATH, "utf-8");
    const upsertMatch = src.match(/ON DUPLICATE KEY UPDATE[\s\S]*?(?=\`|"|$)/i);
    if (upsertMatch) {
      const updateClause = upsertMatch[0];
      const avgInUpdate = /entering_avg\s*=/i.test(updateClause);
      assert.strictEqual(avgInUpdate, false, "Import SQL must NOT update entering_avg column");
    }
  });

  it("Given importScores source, when inspected, then SQL does NOT update handicap column", () => {
    const src = fs.readFileSync(SRC_PATH, "utf-8");
    const upsertMatch = src.match(/ON DUPLICATE KEY UPDATE[\s\S]*?(?=\`|"|$)/i);
    if (upsertMatch) {
      const updateClause = upsertMatch[0];
      const handicapInUpdate = /handicap\s*=/i.test(updateClause);
      assert.strictEqual(handicapInUpdate, false, "Import SQL must NOT update handicap column");
    }
  });
});

// ---------------------------------------------------------------------------
// import-scores route: doubles partner guard
// ---------------------------------------------------------------------------

describe("import-scores route guards", () => {
  it("Given import-scores route, when inspected, then it reuses shared no-match error helpers", () => {
    const src = fs.readFileSync(ROUTE_PATH, "utf-8");
    assert.ok(
      src.includes("NO_PARTICIPANTS_MATCHED_ERROR"),
      "Route must reuse NO_PARTICIPANTS_MATCHED_ERROR from import-api helper"
    );
    assert.ok(
      src.includes("isNoParticipantsMatchedError"),
      "Route must reuse isNoParticipantsMatchedError helper"
    );
    assert.ok(
      src.includes("parseCsvTextBody"),
      "Route must reuse parseCsvTextBody helper for csvText validation"
    );
  });

  it("Given import-scores route, when inspected, then it reuses EVENT_TYPE_LIST for valid event types", () => {
    const src = fs.readFileSync(ROUTE_PATH, "utf-8");
    assert.ok(
      src.includes("EVENT_TYPE_LIST"),
      "Route must import and use EVENT_TYPE_LIST from event-constants for event type validation"
    );
    assert.ok(
      !src.includes("VALID_EVENT_TYPES"),
      "Route should not redefine VALID_EVENT_TYPES when EVENT_TYPE_LIST exists"
    );
  });

  it("Given import-scores route, when inspected, then runImport blocks on no_doubles_partner warnings", () => {
    const src = fs.readFileSync(ROUTE_PATH, "utf-8");
    assert.ok(
      src.includes("no_doubles_partner"),
      "Route must check for no_doubles_partner warnings before importing"
    );
  });

  it("Given import-scores route, when inspected, then imports detectCsvEventType", () => {
    const src = fs.readFileSync(ROUTE_PATH, "utf-8");
    assert.ok(
      src.includes("detectCsvEventType"),
      "Route must import detectCsvEventType to validate CSV event type"
    );
  });

  it("Given import-scores route, when inspected, then buildPreview checks for event type mismatch", () => {
    const src = fs.readFileSync(ROUTE_PATH, "utf-8");
    assert.ok(
      src.includes("event_type_mismatch"),
      "Route must return event_type_mismatch error when CSV event type differs from selected"
    );
  });
});

// ---------------------------------------------------------------------------
// ImportScoresModal: warning display and import blocking
// ---------------------------------------------------------------------------

const MODAL_PATH = path.join(
  __dirname,
  "../../src/components/Portal/ImportScoresModal/ImportScoresModal.js"
);

describe("ImportScoresModal warning display", () => {
  it("Given ImportScoresModal, when rendering warning labels, then it uses WARNING_LABELS lookup object", () => {
    const src = fs.readFileSync(MODAL_PATH, "utf-8");
    assert.ok(
      src.includes("WARNING_LABELS"),
      "Modal must use WARNING_LABELS lookup object for warning label text"
    );
  });

  it("Given ImportScoresModal, when rendering scrollable preview tables, then it uses named scroll style constants", () => {
    const src = fs.readFileSync(MODAL_PATH, "utf-8");
    assert.ok(
      src.includes("WARNING_TABLE_SCROLL_STYLE"),
      "Modal must define WARNING_TABLE_SCROLL_STYLE constant"
    );
    assert.ok(
      src.includes("UNMATCHED_TABLE_SCROLL_STYLE"),
      "Modal must define UNMATCHED_TABLE_SCROLL_STYLE constant"
    );
    assert.ok(
      src.includes("MATCHED_TABLE_SCROLL_STYLE"),
      "Modal must define MATCHED_TABLE_SCROLL_STYLE constant"
    );
  });

  it("Given ImportScoresModal, when rendering warnings, then displays no_doubles_partner label", () => {
    const src = fs.readFileSync(MODAL_PATH, "utf-8");
    assert.ok(
      src.includes("no_doubles_partner"),
      "Modal must handle no_doubles_partner warning type for display"
    );
  });

  it("Given ImportScoresModal, when no_doubles_partner warnings exist, then disables import button", () => {
    const src = fs.readFileSync(MODAL_PATH, "utf-8");
    // The disabled condition must reference no_doubles_partner or a derived variable
    // that accounts for blocking warnings
    const disabledMatch = src.match(/disabled\s*=\s*\{[^}]*\}/g) || [];
    const hasBlockingCheck = disabledMatch.some(
      (d) => d.includes("no_doubles_partner") || d.includes("hasBlockingWarnings") || d.includes("blockImport")
    );
    assert.ok(
      hasBlockingCheck,
      "Import button must be disabled when blocking warnings (no_doubles_partner) exist"
    );
  });
});
