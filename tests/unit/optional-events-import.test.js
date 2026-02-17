const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

let normalizeOptionalName = () => {
  throw new Error("not implemented");
};
let matchOptionalEventsParticipants = async () => {
  throw new Error("not implemented");
};

const person = (overrides = {}) => ({
  pid: "8836",
  first_name: "Joseph",
  last_name: "Bishop",
  optional_best_3_of_9: 0,
  optional_scratch: 0,
  optional_all_events_hdcp: 0,
  ...overrides,
});

describe("optional events csv import matching", async () => {
  const mod = await import("../../src/utils/portal/importOptionalEventsCsv.js");
  normalizeOptionalName = mod.normalizeOptionalName;
  matchOptionalEventsParticipants = mod.matchOptionalEventsParticipants;

  it("Given punctuation and case, when normalizing names, then text is lowercased and punctuation removed", () => {
    assert.equal(normalizeOptionalName(" O'Connor "), "oconnor");
    assert.equal(normalizeOptionalName("Clint Andrew"), "clintandrew");
  });

  it("Given CSV row with EID/Last/First flags, when matching, then updates include per-event flags", async () => {
    const csvRows = [
      {
        EID: "8836",
        Last: "Bishop",
        First: "Joseph",
        "Best 3 of 9": "1",
        "Optional Scratch": "1",
        "All Events Hdcp": "1",
      },
    ];
    const result = await matchOptionalEventsParticipants(csvRows, [person()]);
    assert.equal(result.errors.length, 0);
    assert.equal(result.matched.length, 1);
    assert.equal(result.matched[0].pid, "8836");
    assert.equal(result.matched[0].optionalBest3Of9, 1);
    assert.equal(result.matched[0].optionalScratch, 1);
    assert.equal(result.matched[0].optionalAllEventsHdcp, 1);
  });

  it("Given EID does not exist but name uniquely matches, when matching, then it falls back to name match", async () => {
    const csvRows = [
      {
        EID: "0000",
        Last: "Bishop",
        First: "Joseph",
        "Best 3 of 9": "1",
        "Optional Scratch": "",
        "All Events Hdcp": "",
      },
    ];
    const result = await matchOptionalEventsParticipants(csvRows, [person()]);
    assert.equal(result.errors.length, 0);
    assert.equal(result.matched.length, 1);
    assert.ok(result.warnings.some((w) => w.includes("by name")));
  });

  it("Given CSV row missing 1-values, when matching, then blank values map to 0", async () => {
    const csvRows = [
      {
        EID: "8836",
        Last: "Bishop",
        First: "Joseph",
        "Best 3 of 9": "",
        "Optional Scratch": "",
        "All Events Hdcp": "",
      },
    ];
    const result = await matchOptionalEventsParticipants(csvRows, [person()]);
    assert.equal(result.errors.length, 0);
    assert.equal(result.matched[0].optionalBest3Of9, 0);
    assert.equal(result.matched[0].optionalScratch, 0);
    assert.equal(result.matched[0].optionalAllEventsHdcp, 0);
  });

  it("Given duplicate EID rows with conflicting values, when validating, then import is blocked", async () => {
    const csvRows = [
      {
        EID: "8836",
        Last: "Bishop",
        First: "Joseph",
        "Best 3 of 9": "1",
        "Optional Scratch": "",
        "All Events Hdcp": "",
      },
      {
        EID: "8836",
        Last: "Bishop",
        First: "Joseph",
        "Best 3 of 9": "",
        "Optional Scratch": "",
        "All Events Hdcp": "",
      },
    ];
    const result = await matchOptionalEventsParticipants(csvRows, [person()]);
    assert.ok(result.errors.some((error) => error.includes("conflicting duplicate")));
  });

  it("Given unmatched rows and people not present in CSV, when updates are built, then unmatched are reported and non-listed people are set to 0", async () => {
    const csvRows = [
      {
        EID: "8836",
        Last: "Bishop",
        First: "Joseph",
        "Best 3 of 9": "1",
        "Optional Scratch": "",
        "All Events Hdcp": "",
      },
      {
        EID: "0000",
        Last: "Missing",
        First: "Person",
        "Best 3 of 9": "1",
        "Optional Scratch": "1",
        "All Events Hdcp": "1",
      },
    ];
    const dbPeople = [person(), person({ pid: "9418", first_name: "Bob", last_name: "Hom" })];
    const result = await matchOptionalEventsParticipants(csvRows, dbPeople);
    assert.equal(result.errors.length, 0);
    assert.equal(result.unmatched.length, 1);
    const bishop = result.updates.find((entry) => entry.pid === "8836");
    const hom = result.updates.find((entry) => entry.pid === "9418");
    assert.equal(bishop.optionalBest3Of9, 1);
    assert.equal(hom.optionalBest3Of9, 0);
    assert.equal(hom.optionalScratch, 0);
    assert.equal(hom.optionalAllEventsHdcp, 0);
    assert.equal(hom.optionalEvents, 0);
  });
});
