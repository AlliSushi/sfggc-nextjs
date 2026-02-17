const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

let normalizeScratchMastersName = () => {
  throw new Error("not implemented");
};
let matchScratchMastersParticipants = async () => {
  throw new Error("not implemented");
};

const row = (overrides = {}) => ({
  pid: "P1",
  first_name: "Joseph",
  last_name: "Bishop",
  nickname: "Joe",
  ...overrides,
});

describe("scratch masters csv import matching", async () => {
  const mod = await import("../../src/utils/portal/importScratchMastersCsv.js");
  normalizeScratchMastersName = mod.normalizeScratchMastersName;
  matchScratchMastersParticipants = mod.matchScratchMastersParticipants;

  it("Given mixed case and punctuation, when normalizing a name, then punctuation is removed and text is lowercased", () => {
    assert.equal(
      normalizeScratchMastersName(" Joe-Bishop, Jr. "),
      "joebishopjr"
    );
  });

  it("Given Bowler Name and SM? rows, when matching participants, then it matches against nickname+last and first+last case-insensitively", async () => {
    const csvRows = [
      { "Bowler Name": "joe bishop", "SM?": "1" },
      { "Bowler Name": "Joseph Bishop", "SM?": "0" },
    ];

    const dbPeople = [row()];

    const result = await matchScratchMastersParticipants(csvRows, dbPeople);
    assert.equal(result.errors.length, 0);
    assert.equal(result.matched.length, 2);
    assert.equal(result.matched[0].pid, "P1");
    assert.equal(result.matched[0].scratchMasters, 1);
    assert.equal(result.matched[1].scratchMasters, 0);
  });

  it("Given duplicate Bowler Name rows with conflicting values, when validating CSV, then import is blocked with an error", async () => {
    const csvRows = [
      { "Bowler Name": "Joe Bishop", "SM?": "1" },
      { "Bowler Name": "Joe Bishop", "SM?": "0" },
    ];
    const result = await matchScratchMastersParticipants(csvRows, [row()]);
    assert.equal(result.matched.length, 0);
    assert.ok(result.errors.some((e) => e.includes("conflicting duplicate")));
  });

  it("Given duplicate Bowler Name rows with identical values, when validating CSV, then import allows deduping without conflict", async () => {
    const csvRows = [
      { "Bowler Name": "Joe Bishop", "SM?": "1" },
      { "Bowler Name": "Joe Bishop", "SM?": "1" },
    ];
    const result = await matchScratchMastersParticipants(csvRows, [row()]);
    assert.equal(result.errors.length, 0);
    assert.equal(result.matched.length, 1);
  });

  it("Given participants missing from CSV, when building updates, then they are marked as scratch masters false", async () => {
    const csvRows = [{ "Bowler Name": "Joe Bishop", "SM?": "1" }];
    const dbPeople = [row({ pid: "P1" }), row({ pid: "P2", first_name: "Ronald", last_name: "Hua", nickname: null })];

    const result = await matchScratchMastersParticipants(csvRows, dbPeople);
    assert.equal(result.errors.length, 0);

    const p1 = result.updates.find((u) => u.pid === "P1");
    const p2 = result.updates.find((u) => u.pid === "P2");
    assert.equal(p1.scratchMasters, 1);
    assert.equal(p2.scratchMasters, 0);
  });
});
