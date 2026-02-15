const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

let buildScratchMasters = () => {
  throw new Error("not implemented");
};
let hasAnyScratchMasters = () => {
  throw new Error("not implemented");
};
let DIVISION_ORDER = [];
let hasDivisionOrderExportOnScratchMasters = true;

describe("scratch-masters utility", async () => {
  const mod = await import("../../src/utils/portal/scratch-masters.js");
  const divisionMod = await import("../../src/utils/portal/division-constants.js");
  buildScratchMasters = mod.buildScratchMasters;
  hasAnyScratchMasters = mod.hasAnyScratchMasters;
  DIVISION_ORDER = divisionMod.DIVISION_ORDER;
  hasDivisionOrderExportOnScratchMasters = Object.prototype.hasOwnProperty.call(
    mod,
    "DIVISION_ORDER"
  );

  it("Given rows across events and divisions, when building standings, then participants are ranked by cumulative total within each division", () => {
    const rows = [
      { division: "A", pid: "P1", first_name: "Alpha", last_name: "One", nickname: "", event_type: "team", game1: 200, game2: 210, game3: 220, handicap: 5 },
      { division: "A", pid: "P1", first_name: "Alpha", last_name: "One", nickname: "", event_type: "doubles", game1: 190, game2: 180, game3: 170, handicap: 5 },
      { division: "A", pid: "P2", first_name: "Alpha", last_name: "Two", nickname: "", event_type: "team", game1: 180, game2: 180, game3: 180, handicap: 10 },
      { division: "B", pid: "P3", first_name: "Bravo", last_name: "One", nickname: "", event_type: "team", game1: 150, game2: 150, game3: 150, handicap: 20 },
      { division: "B", pid: "P3", first_name: "Bravo", last_name: "One", nickname: "", event_type: "singles", game1: 140, game2: null, game3: null, handicap: 20 },
    ];

    const result = buildScratchMasters(rows);

    assert.deepEqual(
      DIVISION_ORDER,
      ["A", "B", "C", "D", "E"],
      "Expected stable division order A-E"
    );
    assert.equal(result.A.length, 2);
    assert.equal(result.A[0].pid, "P1");
    assert.equal(result.A[0].rank, 1);
    assert.equal(result.A[0].totalScratch, 1170);
    assert.equal(result.A[0].hdcp, undefined);
    assert.equal(result.A[0].total, 1170);
    assert.equal(result.A[0].t1, 200);
    assert.equal(result.A[0].t2, 210);
    assert.equal(result.A[0].t3, 220);
    assert.equal(result.A[0].d1, 190);
    assert.equal(result.A[0].d2, 180);
    assert.equal(result.A[0].d3, 170);
    assert.equal(result.A[0].s1, null);

    assert.equal(result.A[1].pid, "P2");
    assert.equal(result.A[1].rank, 2);
    assert.equal(result.A[1].totalScratch, 540);
    assert.equal(result.A[1].hdcp, undefined);
    assert.equal(result.A[1].total, 540);

    assert.equal(result.B[0].pid, "P3");
    assert.equal(result.B[0].totalScratch, 590);
    assert.equal(result.B[0].hdcp, undefined);
    assert.equal(result.B[0].total, 590);
  });

  it("Given a division participant with no game scores, when building standings, then totals are null and entry is placed after scored participants", () => {
    const rows = [
      { division: "C", pid: "P10", first_name: "Charlie", last_name: "Scored", nickname: "", event_type: "singles", game1: 100, game2: 110, game3: 120, handicap: 15 },
      { division: "C", pid: "P11", first_name: "Charlie", last_name: "Empty", nickname: "", event_type: "team", game1: null, game2: null, game3: null, handicap: 15 },
    ];

    const result = buildScratchMasters(rows);
    assert.equal(result.C.length, 2);
    assert.equal(result.C[0].pid, "P10");
    assert.equal(result.C[0].rank, 1);
    assert.equal(result.C[1].pid, "P11");
    assert.equal(result.C[1].rank, 2);
    assert.equal(result.C[1].totalScratch, null);
    assert.equal(result.C[1].hdcp, undefined);
    assert.equal(result.C[1].total, null);
    assert.equal(result.C[1].t1, null);
    assert.equal(result.C[1].d1, null);
    assert.equal(result.C[1].s1, null);
  });

  it("Given empty standings, when checking presence, then hasAnyScratchMasters returns false", () => {
    const standings = { A: [], B: [], C: [], D: [], E: [] };
    assert.equal(hasAnyScratchMasters(standings), false);
  });

  it("Given any non-empty division standings, when checking presence, then hasAnyScratchMasters returns true", () => {
    const standings = { A: [], B: [{ rank: 1 }], C: [], D: [], E: [] };
    assert.equal(hasAnyScratchMasters(standings), true);
  });

  it("Given scratch-masters utility exports, when inspected, then DIVISION_ORDER is sourced only from division-constants", () => {
    assert.equal(hasDivisionOrderExportOnScratchMasters, false);
  });
});
