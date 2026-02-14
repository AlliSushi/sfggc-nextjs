import { describe, it } from "node:test";
import assert from "node:assert/strict";

let mod;
try {
  mod = await import("../../src/utils/portal/score-standings.js");
} catch {
  mod = {};
}

const {
  buildTeamStandings = () => { throw new Error("not implemented"); },
  buildDoublesStandings = () => { throw new Error("not implemented"); },
  buildSinglesStandings = () => { throw new Error("not implemented"); },
  buildScoreStandings = () => { throw new Error("not implemented"); },
  hasAnyScores = () => { throw new Error("not implemented"); },
} = mod;

// ---------------------------------------------------------------------------
// Helpers — build DB row shapes matching the SQL queries in the plan
// ---------------------------------------------------------------------------

const teamRow = (overrides = {}) => ({
  tnmt_id: "T1",
  team_name: "Day One Crew",
  slug: "day-one-crew",
  pid: "P100",
  first_name: "Ronald",
  last_name: "Hua",
  nickname: null,
  game1: 189,
  game2: 210,
  game3: 175,
  handicap: 40,
  ...overrides,
});

const doublesRow = (overrides = {}) => ({
  did: "D1",
  pid: "P100",
  first_name: "Ronald",
  last_name: "Hua",
  nickname: null,
  game1: 189,
  game2: 210,
  game3: 175,
  handicap: 40,
  ...overrides,
});

const singlesRow = (overrides = {}) => ({
  pid: "P100",
  first_name: "Ronald",
  last_name: "Hua",
  nickname: null,
  game1: 189,
  game2: 210,
  game3: 175,
  handicap: 40,
  ...overrides,
});

// ---------------------------------------------------------------------------
// buildTeamStandings
// ---------------------------------------------------------------------------

describe("buildTeamStandings", () => {
  it("Given 2 teams with 4 members each having all scores, when built, then returns 2 entries ranked by total descending", () => {
    const rows = [
      // Team Alpha: game sums = 800+820+780 = 2400 scratch, hdcp = (40+30+20+10)*3 = 300, total = 2700
      teamRow({ tnmt_id: "T1", team_name: "Team Alpha", slug: "team-alpha", pid: "P1", game1: 200, game2: 210, game3: 190, handicap: 40 }),
      teamRow({ tnmt_id: "T1", team_name: "Team Alpha", slug: "team-alpha", pid: "P2", game1: 200, game2: 200, game3: 200, handicap: 30 }),
      teamRow({ tnmt_id: "T1", team_name: "Team Alpha", slug: "team-alpha", pid: "P3", game1: 200, game2: 210, game3: 190, handicap: 20 }),
      teamRow({ tnmt_id: "T1", team_name: "Team Alpha", slug: "team-alpha", pid: "P4", game1: 200, game2: 200, game3: 200, handicap: 10 }),
      // Team Beta: game sums = 600+620+580 = 1800 scratch, hdcp = (50+50+50+50)*3 = 600, total = 2400
      teamRow({ tnmt_id: "T2", team_name: "Team Beta", slug: "team-beta", pid: "P5", game1: 150, game2: 155, game3: 145, handicap: 50 }),
      teamRow({ tnmt_id: "T2", team_name: "Team Beta", slug: "team-beta", pid: "P6", game1: 150, game2: 155, game3: 145, handicap: 50 }),
      teamRow({ tnmt_id: "T2", team_name: "Team Beta", slug: "team-beta", pid: "P7", game1: 150, game2: 155, game3: 145, handicap: 50 }),
      teamRow({ tnmt_id: "T2", team_name: "Team Beta", slug: "team-beta", pid: "P8", game1: 150, game2: 155, game3: 145, handicap: 50 }),
    ];

    const result = buildTeamStandings(rows);
    assert.strictEqual(result.length, 2);
    // Team Alpha has higher total (2700 > 2400)
    assert.strictEqual(result[0].teamName, "Team Alpha");
    assert.strictEqual(result[0].rank, 1);
    assert.strictEqual(result[0].game1, 800);
    assert.strictEqual(result[0].game2, 820);
    assert.strictEqual(result[0].game3, 780);
    assert.strictEqual(result[0].totalScratch, 2400);
    assert.strictEqual(result[0].hdcp, 300);
    assert.strictEqual(result[0].total, 2700);
    assert.strictEqual(result[0].teamSlug, "team-alpha");

    assert.strictEqual(result[1].teamName, "Team Beta");
    assert.strictEqual(result[1].rank, 2);
    assert.strictEqual(result[1].totalScratch, 1800);
    assert.strictEqual(result[1].hdcp, 600);
    assert.strictEqual(result[1].total, 2400);
  });

  it("Given team with some members lacking scores, when built, then sums only non-null values", () => {
    const rows = [
      teamRow({ tnmt_id: "T1", team_name: "Partial", slug: "partial", pid: "P1", game1: 200, game2: 210, game3: 190, handicap: 40 }),
      teamRow({ tnmt_id: "T1", team_name: "Partial", slug: "partial", pid: "P2", game1: 180, game2: 190, game3: 170, handicap: 50 }),
      teamRow({ tnmt_id: "T1", team_name: "Partial", slug: "partial", pid: "P3", game1: null, game2: null, game3: null, handicap: 30 }),
      teamRow({ tnmt_id: "T1", team_name: "Partial", slug: "partial", pid: "P4", game1: null, game2: null, game3: null, handicap: 20 }),
    ];

    const result = buildTeamStandings(rows);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].game1, 380);
    assert.strictEqual(result[0].game2, 400);
    assert.strictEqual(result[0].game3, 360);
    assert.strictEqual(result[0].totalScratch, 1140);
    // HDCP uses ALL members' handicaps (even those without scores)
    assert.strictEqual(result[0].hdcp, (40 + 50 + 30 + 20) * 3);
    assert.strictEqual(result[0].total, 1140 + (40 + 50 + 30 + 20) * 3);
  });

  it("Given team where no members have any game scores, when built, then that team is excluded", () => {
    const rows = [
      teamRow({ tnmt_id: "T1", team_name: "Has Scores", slug: "has-scores", pid: "P1", game1: 200, game2: 200, game3: 200, handicap: 0 }),
      teamRow({ tnmt_id: "T2", team_name: "No Scores", slug: "no-scores", pid: "P2", game1: null, game2: null, game3: null, handicap: 40 }),
    ];

    const result = buildTeamStandings(rows);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].teamName, "Has Scores");
  });

  it("Given all teams have no game scores, when built, then returns empty array", () => {
    const rows = [
      teamRow({ tnmt_id: "T1", team_name: "No Scores A", slug: "no-scores-a", pid: "P1", game1: null, game2: null, game3: null, handicap: 40 }),
      teamRow({ tnmt_id: "T2", team_name: "No Scores B", slug: "no-scores-b", pid: "P2", game1: null, game2: null, game3: null, handicap: 30 }),
    ];

    const result = buildTeamStandings(rows);
    assert.deepStrictEqual(result, []);
  });

  it("Given team with only game 1 scores (mid-event), when built, then totalScratch and total are null", () => {
    const rows = [
      teamRow({ tnmt_id: "T1", team_name: "Mid Event", slug: "mid-event", pid: "P1", game1: 200, game2: null, game3: null, handicap: 30 }),
      teamRow({ tnmt_id: "T1", team_name: "Mid Event", slug: "mid-event", pid: "P2", game1: 180, game2: null, game3: null, handicap: 40 }),
    ];

    const result = buildTeamStandings(rows);
    assert.strictEqual(result[0].game1, 380);
    assert.strictEqual(result[0].game2, null);
    assert.strictEqual(result[0].game3, null);
    assert.strictEqual(result[0].totalScratch, null);
    assert.strictEqual(result[0].total, null);
  });

  it("Given empty rows, when built, then returns empty array", () => {
    const result = buildTeamStandings([]);
    assert.deepStrictEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// buildDoublesStandings
// ---------------------------------------------------------------------------

describe("buildDoublesStandings", () => {
  it("Given 2 doubles pairs with 2 members each, when built, then returns pairs ranked by doublesTotal descending with individual member scores", () => {
    const rows = [
      // Pair 1: P1 scratch=600 hdcp=40*3=120 total=720; P2 scratch=600 hdcp=30*3=90 total=690
      // doublesScratch=1200, doublesTotal=1410
      doublesRow({ did: "D1", pid: "P1", first_name: "Ronald", last_name: "Hua", game1: 200, game2: 210, game3: 190, handicap: 40 }),
      doublesRow({ did: "D1", pid: "P2", first_name: "Kellen", last_name: "Parker", game1: 200, game2: 210, game3: 190, handicap: 30 }),
      // Pair 2: P3 scratch=450 hdcp=50*3=150 total=600; P4 scratch=450 hdcp=50*3=150 total=600
      // doublesScratch=900, doublesTotal=1200
      doublesRow({ did: "D2", pid: "P3", first_name: "Kenny", last_name: "Siu", game1: 150, game2: 160, game3: 140, handicap: 50 }),
      doublesRow({ did: "D2", pid: "P4", first_name: "Bob", last_name: "Hom", game1: 150, game2: 160, game3: 140, handicap: 50 }),
    ];

    const result = buildDoublesStandings(rows);
    assert.strictEqual(result.length, 2);

    // Pair 1 ranked first (doublesTotal 1410 > 1200)
    assert.strictEqual(result[0].rank, 1);
    assert.strictEqual(result[0].doublesScratch, 1200);
    assert.strictEqual(result[0].doublesTotal, 1410);

    // Individual member scores for pair 1
    assert.strictEqual(result[0].members[0].game1, 200);
    assert.strictEqual(result[0].members[0].game2, 210);
    assert.strictEqual(result[0].members[0].game3, 190);
    assert.strictEqual(result[0].members[0].totalScratch, 600);
    assert.strictEqual(result[0].members[0].hdcp, 120);
    assert.strictEqual(result[0].members[0].total, 720);

    assert.strictEqual(result[0].members[1].totalScratch, 600);
    assert.strictEqual(result[0].members[1].hdcp, 90);
    assert.strictEqual(result[0].members[1].total, 690);

    // Pair 2
    assert.strictEqual(result[1].rank, 2);
    assert.strictEqual(result[1].doublesScratch, 900);
    assert.strictEqual(result[1].doublesTotal, 1200);
  });

  it("Given doubles pair rows with nicknames, when built, then pairName uses nicknames via buildDisplayName", () => {
    const rows = [
      doublesRow({ did: "D1", pid: "P1", first_name: "Joseph", last_name: "Bishop", nickname: "Joe", game1: 180, game2: 190, game3: 170, handicap: 40 }),
      doublesRow({ did: "D1", pid: "P2", first_name: "Robert", last_name: "Martin", nickname: "Bob", game1: 180, game2: 190, game3: 170, handicap: 30 }),
    ];

    const result = buildDoublesStandings(rows);
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].pairName.includes("Joe Bishop"), `Expected 'Joe Bishop' in '${result[0].pairName}'`);
    assert.ok(result[0].pairName.includes("Bob Martin"), `Expected 'Bob Martin' in '${result[0].pairName}'`);
  });

  it("Given doubles pair, when built, then members array contains pid, name, and individual scores for each partner", () => {
    const rows = [
      doublesRow({ did: "D1", pid: "P1", first_name: "Ronald", last_name: "Hua", game1: 200, game2: 200, game3: 200, handicap: 40 }),
      doublesRow({ did: "D1", pid: "P2", first_name: "Kellen", last_name: "Parker", game1: 180, game2: 190, game3: 170, handicap: 30 }),
    ];

    const result = buildDoublesStandings(rows);
    assert.strictEqual(result[0].members.length, 2);
    assert.strictEqual(result[0].members[0].pid, "P1");
    assert.ok(result[0].members[0].name.includes("Ronald"));
    assert.strictEqual(result[0].members[0].game1, 200);
    assert.strictEqual(result[0].members[0].totalScratch, 600);
    assert.strictEqual(result[0].members[0].hdcp, 120);
    assert.strictEqual(result[0].members[0].total, 720);

    assert.strictEqual(result[0].members[1].pid, "P2");
    assert.ok(result[0].members[1].name.includes("Kellen"));
    assert.strictEqual(result[0].members[1].game1, 180);
    assert.strictEqual(result[0].members[1].totalScratch, 540);
    assert.strictEqual(result[0].members[1].hdcp, 90);
    assert.strictEqual(result[0].members[1].total, 630);
  });

  it("Given doubles pairs where no member has any game scores, when built, then those pairs are excluded", () => {
    const rows = [
      // Pair 1 has scores
      doublesRow({ did: "D1", pid: "P1", first_name: "Ronald", last_name: "Hua", game1: 200, game2: 200, game3: 200, handicap: 40 }),
      doublesRow({ did: "D1", pid: "P2", first_name: "Kellen", last_name: "Parker", game1: 200, game2: 200, game3: 200, handicap: 30 }),
      // Pair 2 has NO game scores (only handicap from book average)
      doublesRow({ did: "D2", pid: "P3", first_name: "Kenny", last_name: "Siu", game1: null, game2: null, game3: null, handicap: 50 }),
      doublesRow({ did: "D2", pid: "P4", first_name: "Bob", last_name: "Hom", game1: null, game2: null, game3: null, handicap: 50 }),
    ];

    const result = buildDoublesStandings(rows);
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].pairName.includes("Ronald"));
  });

  it("Given all doubles pairs have no game scores, when built, then returns empty array", () => {
    const rows = [
      doublesRow({ did: "D1", pid: "P1", game1: null, game2: null, game3: null, handicap: 40 }),
      doublesRow({ did: "D1", pid: "P2", game1: null, game2: null, game3: null, handicap: 30 }),
    ];

    const result = buildDoublesStandings(rows);
    assert.deepStrictEqual(result, []);
  });

  it("Given empty rows, when built, then returns empty array", () => {
    const result = buildDoublesStandings([]);
    assert.deepStrictEqual(result, []);
  });

  it("Given pair where one member has partial scores, when built, then that member's totalScratch is null and pair totals are null", () => {
    const rows = [
      doublesRow({ did: "D1", pid: "P1", game1: 200, game2: 210, game3: 190, handicap: 40 }),
      doublesRow({ did: "D1", pid: "P2", game1: 150, game2: null, game3: null, handicap: 30 }),
    ];

    const result = buildDoublesStandings(rows);
    assert.strictEqual(result.length, 1);

    // P1 has complete scores
    assert.strictEqual(result[0].members[0].totalScratch, 600);
    assert.strictEqual(result[0].members[0].total, 720);

    // P2 has incomplete scores
    assert.strictEqual(result[0].members[1].game1, 150);
    assert.strictEqual(result[0].members[1].game2, null);
    assert.strictEqual(result[0].members[1].totalScratch, null);
    assert.strictEqual(result[0].members[1].total, null);

    // Pair totals null because P2 is incomplete
    assert.strictEqual(result[0].doublesScratch, null);
    assert.strictEqual(result[0].doublesTotal, null);
  });

  it("Given pair where only one member has scores, when built, then pair is included but pair totals are null", () => {
    const rows = [
      doublesRow({ did: "D1", pid: "P1", game1: 200, game2: 210, game3: 190, handicap: 40 }),
      doublesRow({ did: "D1", pid: "P2", game1: null, game2: null, game3: null, handicap: 30 }),
    ];

    const result = buildDoublesStandings(rows);
    assert.strictEqual(result.length, 1); // pair IS included because P1 has game data
    assert.strictEqual(result[0].members[0].totalScratch, 600);
    assert.strictEqual(result[0].members[1].totalScratch, null);
    assert.strictEqual(result[0].doublesScratch, null);
    assert.strictEqual(result[0].doublesTotal, null);
  });
});

// ---------------------------------------------------------------------------
// buildSinglesStandings
// ---------------------------------------------------------------------------

describe("buildSinglesStandings", () => {
  it("Given 2 individuals with all scores, when built, then ranked by total descending", () => {
    const rows = [
      // Player 1: 189+210+175 = 574 scratch, hdcp = 40*3 = 120, total = 694
      singlesRow({ pid: "P1", first_name: "Ronald", last_name: "Hua", game1: 189, game2: 210, game3: 175, handicap: 40 }),
      // Player 2: 224+230+215 = 669 scratch, hdcp = 0*3 = 0, total = 669
      singlesRow({ pid: "P2", first_name: "Cy", last_name: "Hiyane", game1: 224, game2: 230, game3: 215, handicap: 0 }),
    ];

    const result = buildSinglesStandings(rows);
    assert.strictEqual(result.length, 2);
    // Player 1 has higher total (694 > 669)
    assert.strictEqual(result[0].pid, "P1");
    assert.strictEqual(result[0].rank, 1);
    assert.strictEqual(result[0].totalScratch, 574);
    assert.strictEqual(result[0].hdcp, 120);
    assert.strictEqual(result[0].total, 694);

    assert.strictEqual(result[1].pid, "P2");
    assert.strictEqual(result[1].rank, 2);
    assert.strictEqual(result[1].totalScratch, 669);
    assert.strictEqual(result[1].hdcp, 0);
    assert.strictEqual(result[1].total, 669);
  });

  it("Given individual with nickname, when built, then name uses nickname via buildDisplayName", () => {
    const rows = [
      singlesRow({ pid: "P1", first_name: "Joseph", last_name: "Bishop", nickname: "Joe", game1: 180, game2: 190, game3: 170, handicap: 40 }),
    ];

    const result = buildSinglesStandings(rows);
    assert.strictEqual(result[0].name, "Joe Bishop");
  });

  it("Given individual with only game 1, when built, then totalScratch and total are null but entry is included", () => {
    const rows = [
      singlesRow({ pid: "P1", game1: 200, game2: null, game3: null, handicap: 30 }),
    ];

    const result = buildSinglesStandings(rows);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].game1, 200);
    assert.strictEqual(result[0].game2, null);
    assert.strictEqual(result[0].totalScratch, null);
    assert.strictEqual(result[0].total, null);
  });

  it("Given individual with no game scores at all, when built, then that individual is excluded", () => {
    const rows = [
      singlesRow({ pid: "P1", game1: 200, game2: 210, game3: 190, handicap: 30 }),
      singlesRow({ pid: "P2", game1: null, game2: null, game3: null, handicap: 40 }),
    ];

    const result = buildSinglesStandings(rows);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].pid, "P1");
  });

  it("Given empty rows, when built, then returns empty array", () => {
    const result = buildSinglesStandings([]);
    assert.deepStrictEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// buildScoreStandings (orchestrator)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// hasAnyScores
// ---------------------------------------------------------------------------

describe("hasAnyScores", () => {
  it("Given standings with team entries, when checked, then returns true", () => {
    const standings = { team: [{ rank: 1 }], doubles: [], singles: [] };
    assert.strictEqual(hasAnyScores(standings), true);
  });

  it("Given standings with only doubles entries, when checked, then returns true", () => {
    const standings = { team: [], doubles: [{ rank: 1 }], singles: [] };
    assert.strictEqual(hasAnyScores(standings), true);
  });

  it("Given standings with only singles entries, when checked, then returns true", () => {
    const standings = { team: [], doubles: [], singles: [{ rank: 1 }] };
    assert.strictEqual(hasAnyScores(standings), true);
  });

  it("Given all empty arrays, when checked, then returns false", () => {
    const standings = { team: [], doubles: [], singles: [] };
    assert.strictEqual(hasAnyScores(standings), false);
  });
});

// ---------------------------------------------------------------------------
// buildScoreStandings (orchestrator)
// ---------------------------------------------------------------------------

describe("buildScoreStandings", () => {
  it("Given all three row sets, when built, then returns object with team, doubles, and singles keys", () => {
    const teamRows = [
      teamRow({ tnmt_id: "T1", team_name: "Alpha", slug: "alpha", pid: "P1", game1: 200, game2: 200, game3: 200, handicap: 10 }),
    ];
    const doublesRows = [
      doublesRow({ did: "D1", pid: "P2", game1: 180, game2: 180, game3: 180, handicap: 20 }),
    ];
    const singlesRows = [
      singlesRow({ pid: "P3", game1: 190, game2: 190, game3: 190, handicap: 5 }),
    ];

    const result = buildScoreStandings({ teamRows, doublesRows, singlesRows });
    assert.ok(Array.isArray(result.team), "result.team should be an array");
    assert.ok(Array.isArray(result.doubles), "result.doubles should be an array");
    assert.ok(Array.isArray(result.singles), "result.singles should be an array");
    assert.strictEqual(result.team.length, 1);
    assert.strictEqual(result.doubles.length, 1);
    assert.strictEqual(result.singles.length, 1);
  });
});
