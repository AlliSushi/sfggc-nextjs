const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PARTICIPANT_LIST_API = path.join(
  process.cwd(),
  "src/pages/api/portal/participants/index.js"
);
const PARTICIPANT_DETAIL_API = path.join(
  process.cwd(),
  "src/pages/api/portal/participants/[pid].js"
);
const PARTICIPANT_DB = path.join(
  process.cwd(),
  "src/utils/portal/participant-db.js"
);

describe("Book average (entering_avg) in participant APIs", () => {
  test("Given participant list API (GET), when returning all participants, then query includes book_average from scores table", () => {
    const apiSrc = fs.readFileSync(PARTICIPANT_LIST_API, "utf-8");

    // API query should SELECT entering_avg from scores table and alias it as book_average
    const selectsBookAverage = apiSrc.match(/select.*entering_avg.*as book_average/is);

    assert.ok(
      selectsBookAverage,
      "participants/index.js API query must SELECT entering_avg as book_average from scores table"
    );
  });

  test("Given formatParticipant function, when formatting participant data, then it returns bookAverage property", () => {
    const dbSrc = fs.readFileSync(PARTICIPANT_DB, "utf-8");

    // formatParticipant should return bookAverage in the return object
    const returnsBookAverage = dbSrc.match(/return \{[\s\S]{0,1000}bookAverage:/);

    assert.ok(
      returnsBookAverage,
      "formatParticipant must return bookAverage property"
    );
  });

  test("Given participant detail API (GET), when returning single participant, then it uses formatParticipant which includes bookAverage", () => {
    const apiSrc = fs.readFileSync(PARTICIPANT_DETAIL_API, "utf-8");
    const dbSrc = fs.readFileSync(PARTICIPANT_DB, "utf-8");

    // GET handler uses formatParticipant which should return bookAverage
    const usesFormatParticipant = apiSrc.includes("formatParticipant");
    const formatReturnsBookAverage = dbSrc.match(/return \{[\s\S]{0,1000}bookAverage:/);

    assert.ok(
      usesFormatParticipant && formatReturnsBookAverage,
      "participants/[pid].js GET must include bookAverage via formatParticipant"
    );
  });

  test("Given participant detail API (PATCH), when updating participant, then upsertScores updates entering_avg for bookAverage", () => {
    const apiSrc = fs.readFileSync(PARTICIPANT_DETAIL_API, "utf-8");
    const dbSrc = fs.readFileSync(PARTICIPANT_DB, "utf-8");

    // PATCH handler uses applyParticipantUpdates which calls upsertScores
    const usesApplyUpdates = apiSrc.includes("applyParticipantUpdates");

    // upsertScores should handle bookAverage by setting entering_avg
    const handlesBookAverage = dbSrc.match(/bookAverage.*entering_avg|entering_avg.*bookAverage/is);

    assert.ok(
      usesApplyUpdates && handlesBookAverage,
      "upsertScores must handle bookAverage and update entering_avg in scores table"
    );
  });

  test("Given upsertScores function, when updating book_average, then it updates entering_avg for all three event types", () => {
    const dbSrc = fs.readFileSync(PARTICIPANT_DB, "utf-8");

    // upsertScores imports EVENT_TYPE_LIST from event-constants and loops through it
    const importsEventTypes = dbSrc.match(/import.*EVENT_TYPE_LIST.*from.*event-constants/);
    const loopsEventTypes = dbSrc.match(/for.*EVENT_TYPE_LIST.*eventType/is);
    const insertsEnteringAvg = dbSrc.match(/insert into scores[\s\S]{0,500}entering_avg/i);

    assert.ok(
      importsEventTypes && loopsEventTypes && insertsEnteringAvg,
      "upsertScores must import EVENT_TYPE_LIST from event-constants and loop through all event types (team, doubles, singles) to INSERT/UPDATE entering_avg"
    );
  });
});
