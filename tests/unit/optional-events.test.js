const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

let buildOptionalEventsStandings = () => {
  throw new Error("not implemented");
};
let hasAnyOptionalEvents = () => {
  throw new Error("not implemented");
};
let createEmptyOptionalEventsStandings = () => {
  throw new Error("not implemented");
};
let DIVISION_ORDER = [];
let hasDivisionOrderExportOnOptionalEvents = true;

describe("optional-events utility", async () => {
  const mod = await import("../../src/utils/portal/optional-events.js");
  const divisionMod = await import("../../src/utils/portal/division-constants.js");
  buildOptionalEventsStandings = mod.buildOptionalEventsStandings;
  hasAnyOptionalEvents = mod.hasAnyOptionalEvents;
  createEmptyOptionalEventsStandings = mod.createEmptyOptionalEventsStandings;
  DIVISION_ORDER = divisionMod.DIVISION_ORDER;
  hasDivisionOrderExportOnOptionalEvents = Object.prototype.hasOwnProperty.call(
    mod,
    "DIVISION_ORDER"
  );

  it("Given participants with optional-event scores, when building standings, then best of 3 and all-events handicapped are ranked by total", () => {
    const rows = [
      {
        pid: "P1",
        first_name: "Alex",
        last_name: "One",
        nickname: "",
        division: "A",
        optional_best_3_of_9: 1,
        optional_scratch: 1,
        optional_all_events_hdcp: 1,
        event_type: "team",
        game1: 200,
        game2: 190,
        game3: 180,
        handicap: 10,
      },
      {
        pid: "P1",
        first_name: "Alex",
        last_name: "One",
        nickname: "",
        division: "A",
        optional_best_3_of_9: 1,
        optional_scratch: 1,
        optional_all_events_hdcp: 1,
        event_type: "doubles",
        game1: 210,
        game2: 205,
        game3: 195,
        handicap: 10,
      },
      {
        pid: "P1",
        first_name: "Alex",
        last_name: "One",
        nickname: "",
        division: "A",
        optional_best_3_of_9: 1,
        optional_scratch: 1,
        optional_all_events_hdcp: 1,
        event_type: "singles",
        game1: 220,
        game2: 215,
        game3: 200,
        handicap: 10,
      },
      {
        pid: "P2",
        first_name: "Ben",
        last_name: "Two",
        nickname: "",
        division: "A",
        optional_best_3_of_9: 1,
        optional_scratch: 1,
        optional_all_events_hdcp: 1,
        event_type: "team",
        game1: 180,
        game2: 175,
        game3: 170,
        handicap: 20,
      },
      {
        pid: "P2",
        first_name: "Ben",
        last_name: "Two",
        nickname: "",
        division: "A",
        optional_best_3_of_9: 1,
        optional_scratch: 1,
        optional_all_events_hdcp: 1,
        event_type: "doubles",
        game1: 190,
        game2: 185,
        game3: 180,
        handicap: 20,
      },
      {
        pid: "P2",
        first_name: "Ben",
        last_name: "Two",
        nickname: "",
        division: "A",
        optional_best_3_of_9: 1,
        optional_scratch: 1,
        optional_all_events_hdcp: 1,
        event_type: "singles",
        game1: 195,
        game2: 190,
        game3: 185,
        handicap: 20,
      },
    ];

    const result = buildOptionalEventsStandings(rows);

    assert.equal(result.bestOf3Of9.length, 2);
    assert.equal(result.bestOf3Of9[0].pid, "P1");
    assert.equal(result.bestOf3Of9[0].rank, 1);
    assert.equal(result.bestOf3Of9[0].bestGame1, 230);
    assert.equal(result.bestOf3Of9[0].bestGame2, 225);
    assert.equal(result.bestOf3Of9[0].bestGame3, 220);
    assert.equal(result.bestOf3Of9[0].total, 675);

    assert.equal(result.allEventsHandicapped.length, 2);
    assert.equal(result.allEventsHandicapped[0].pid, "P1");
    assert.equal(result.allEventsHandicapped[0].rank, 1);
    assert.equal(result.allEventsHandicapped[0].totalScratch, 1815);
    assert.equal(result.allEventsHandicapped[0].totalHdcp, 90);
    assert.equal(result.allEventsHandicapped[0].total, 1905);
  });

  it("Given divisions with optional scratch data, when building standings, then each division is ranked by scratch total and includes all 5 divisions", () => {
    const rows = [
      {
        pid: "P10",
        first_name: "Casey",
        last_name: "Ace",
        nickname: "",
        division: "A",
        optional_best_3_of_9: 0,
        optional_scratch: 1,
        optional_all_events_hdcp: 0,
        event_type: "team",
        game1: 200,
        game2: 200,
        game3: 200,
        handicap: 0,
      },
      {
        pid: "P11",
        first_name: "Dana",
        last_name: "Bee",
        nickname: "",
        division: "B",
        optional_best_3_of_9: 0,
        optional_scratch: 1,
        optional_all_events_hdcp: 0,
        event_type: "singles",
        game1: 150,
        game2: 150,
        game3: 150,
        handicap: 0,
      },
    ];

    const result = buildOptionalEventsStandings(rows);
    assert.deepEqual(DIVISION_ORDER, ["A", "B", "C", "D", "E"]);
    assert.equal(result.optionalScratch.A.length, 1);
    assert.equal(result.optionalScratch.A[0].pid, "P10");
    assert.equal(result.optionalScratch.A[0].rank, 1);
    assert.equal(result.optionalScratch.A[0].totalScratch, 600);
    assert.equal(result.optionalScratch.B.length, 1);
    assert.equal(result.optionalScratch.B[0].totalScratch, 450);
    assert.deepEqual(result.optionalScratch.C, []);
    assert.deepEqual(result.optionalScratch.D, []);
    assert.deepEqual(result.optionalScratch.E, []);
  });

  it("Given empty optional standings, when checking for data, then helper returns false", () => {
    const empty = createEmptyOptionalEventsStandings();
    assert.equal(hasAnyOptionalEvents(empty), false);
  });

  it("Given non-empty optional standings, when checking for data, then helper returns true", () => {
    const empty = createEmptyOptionalEventsStandings();
    empty.bestOf3Of9.push({ rank: 1 });
    assert.equal(hasAnyOptionalEvents(empty), true);
  });

  it("Given optional-events utility exports, when inspected, then DIVISION_ORDER is sourced only from division-constants", () => {
    assert.equal(hasDivisionOrderExportOnOptionalEvents, false);
  });
});
