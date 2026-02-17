const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PARTICIPANT_DB = path.join(process.cwd(), "src/utils/portal/participant-db.js");
const PARTICIPANTS_API = path.join(process.cwd(), "src/pages/api/portal/participants/index.js");
const PARTICIPANT_DETAIL_API = path.join(process.cwd(), "src/pages/api/portal/participants/[pid].js");

describe("Nickname in database queries", () => {
  test("Given participant-db.js, when fetching participants, then SELECT includes nickname", () => {
    const src = fs.readFileSync(PARTICIPANT_DB, "utf-8");

    // Find SELECT statements that fetch people/participant data
    const selectMatches = src.match(/select[\s\S]{0,300}from people/gi) || [];
    assert.ok(selectMatches.length > 0, "participant-db.js must have SELECT statements from people table");

    // At least one SELECT should include nickname
    const hasNickname = selectMatches.some(select => select.includes("nickname"));
    assert.ok(
      hasNickname,
      "At least one SELECT statement must include nickname column"
    );
  });
});

describe("Nickname in API responses", () => {
  test("Given participants list API, when returning participant data, then response includes nickname", () => {
    const src = fs.readFileSync(PARTICIPANTS_API, "utf-8");

    // Should fetch or include nickname in response
    assert.ok(
      src.includes("nickname"),
      "participants/index.js API must include nickname in responses"
    );
  });

  test("Given participant detail API (GET), when returning single participant, then response includes nickname", () => {
    const apiSrc = fs.readFileSync(PARTICIPANT_DETAIL_API, "utf-8");
    const dbSrc = fs.readFileSync(PARTICIPANT_DB, "utf-8");

    // GET handler uses formatParticipant which should return nickname
    const usesFormatParticipant = apiSrc.includes("formatParticipant");
    const formatReturnsNickname = dbSrc.match(/return \{[\s\S]{0,500}nickname:/);

    assert.ok(
      usesFormatParticipant && formatReturnsNickname,
      "participants/[pid].js GET must include nickname in response via formatParticipant"
    );
  });

  test("Given participant detail API (PATCH), when updating participant, then nickname can be updated", () => {
    const apiSrc = fs.readFileSync(PARTICIPANT_DETAIL_API, "utf-8");
    const dbSrc = fs.readFileSync(PARTICIPANT_DB, "utf-8");

    // PATCH handler uses upsertPerson which should accept nickname
    const usesUpsertPerson = apiSrc.includes("applyParticipantUpdates");
    const upsertHasNickname = dbSrc.match(/insert into people[\s\S]{0,1000}nickname[\s\S]{0,1000}on duplicate key update[\s\S]{0,500}nickname/i);

    assert.ok(
      usesUpsertPerson && upsertHasNickname,
      "participants/[pid].js PATCH must support updating nickname field via upsertPerson"
    );
  });
});
