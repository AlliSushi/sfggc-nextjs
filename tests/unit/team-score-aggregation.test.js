import { describe, it } from "node:test";
import assert from "node:assert/strict";

let mod;
try {
  mod = await import("../../src/utils/portal/team-scores.js");
} catch {
  mod = {};
}

const {
  extractTeamScores = () => { throw new Error("not implemented"); },
  extractTeamLane = () => { throw new Error("not implemented"); },
  extractDoublesPairScores = () => { throw new Error("not implemented"); },
} = mod;

// ---------------------------------------------------------------------------
// extractTeamScores
// ---------------------------------------------------------------------------

describe("extractTeamScores", () => {
  it("Given 4 members each with game scores, when extracted, then returns sum of all members' scores per game", () => {
    const members = [
      { team_game1: 150, team_game2: 160, team_game3: 170 },
      { team_game1: 180, team_game2: 190, team_game3: 200 },
      { team_game1: 140, team_game2: 130, team_game3: 155 },
      { team_game1: 165, team_game2: 175, team_game3: 185 },
    ];
    const result = extractTeamScores(members);
    assert.deepStrictEqual(result, [635, 655, 710]);
  });

  it("Given 4 members where only 2 have scores, when extracted, then sums only the 2 members with scores", () => {
    const members = [
      { team_game1: 150, team_game2: 160, team_game3: 170 },
      { team_game1: null, team_game2: null, team_game3: null },
      { team_game1: 200, team_game2: 180, team_game3: 190 },
      { team_game1: null, team_game2: null, team_game3: null },
    ];
    const result = extractTeamScores(members);
    assert.deepStrictEqual(result, [350, 340, 360]);
  });

  it("Given no members with scores, when extracted, then returns empty array", () => {
    const members = [
      { team_game1: null, team_game2: null, team_game3: null },
      { team_game1: null, team_game2: null, team_game3: null },
    ];
    const result = extractTeamScores(members);
    assert.deepStrictEqual(result, []);
  });

  it("Given 4 members with only game1 scores (mid-event), when extracted, then returns array with just game1 sum", () => {
    const members = [
      { team_game1: 189, team_game2: null, team_game3: null },
      { team_game1: 224, team_game2: null, team_game3: null },
      { team_game1: 203, team_game2: null, team_game3: null },
      { team_game1: 215, team_game2: null, team_game3: null },
    ];
    const result = extractTeamScores(members);
    assert.deepStrictEqual(result, [831]);
  });

  it("Given members with mixed null/non-null game scores, when extracted, then each game sums only non-null values", () => {
    const members = [
      { team_game1: 150, team_game2: 160, team_game3: null },
      { team_game1: 200, team_game2: null, team_game3: null },
      { team_game1: null, team_game2: 180, team_game3: null },
    ];
    const result = extractTeamScores(members);
    // game1: 150+200=350, game2: 160+180=340, game3: all null -> excluded
    assert.deepStrictEqual(result, [350, 340]);
  });

  it("Given empty members array, when extracted, then returns empty array", () => {
    const result = extractTeamScores([]);
    assert.deepStrictEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// extractTeamLane
// ---------------------------------------------------------------------------

describe("extractTeamLane", () => {
  it("Given members where one has a team lane, when extracted, then returns that lane", () => {
    const members = [
      { team_lane: null },
      { team_lane: "15" },
      { team_lane: null },
    ];
    const result = extractTeamLane(members);
    assert.strictEqual(result, "15");
  });

  it("Given no members with team lane, when extracted, then returns empty string", () => {
    const members = [
      { team_lane: null },
      { team_lane: null },
    ];
    const result = extractTeamLane(members);
    assert.strictEqual(result, "");
  });
});

// ---------------------------------------------------------------------------
// extractDoublesPairScores
// ---------------------------------------------------------------------------

describe("extractDoublesPairScores", () => {
  it("Given two partners with all doubles game scores, when extracted, then returns sum per game", () => {
    const member1 = { doubles_game1: 180, doubles_game2: 200, doubles_game3: 190 };
    const member2 = { doubles_game1: 160, doubles_game2: 170, doubles_game3: 185 };
    const result = extractDoublesPairScores(member1, member2);
    assert.deepStrictEqual(result, [340, 370, 375]);
  });

  it("Given one partner with scores and one without, when extracted, then returns first partner's scores", () => {
    const member1 = { doubles_game1: 180, doubles_game2: 200, doubles_game3: 190 };
    const member2 = { doubles_game1: null, doubles_game2: null, doubles_game3: null };
    const result = extractDoublesPairScores(member1, member2);
    assert.deepStrictEqual(result, [180, 200, 190]);
  });

  it("Given neither partner has scores, when extracted, then returns empty array", () => {
    const member1 = { doubles_game1: null, doubles_game2: null, doubles_game3: null };
    const member2 = { doubles_game1: null, doubles_game2: null, doubles_game3: null };
    const result = extractDoublesPairScores(member1, member2);
    assert.deepStrictEqual(result, []);
  });

  it("Given null partner, when extracted, then returns first member's scores", () => {
    const member1 = { doubles_game1: 180, doubles_game2: 200, doubles_game3: 190 };
    const result = extractDoublesPairScores(member1, null);
    assert.deepStrictEqual(result, [180, 200, 190]);
  });

  it("Given partial game scores (mid-event), when extracted, then returns only non-null sums", () => {
    const member1 = { doubles_game1: 180, doubles_game2: null, doubles_game3: null };
    const member2 = { doubles_game1: 160, doubles_game2: null, doubles_game3: null };
    const result = extractDoublesPairScores(member1, member2);
    assert.deepStrictEqual(result, [340]);
  });
});
