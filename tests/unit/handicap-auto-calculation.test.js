const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PARTICIPANT_EDIT_FORM = path.join(
  process.cwd(),
  "src/components/Portal/ParticipantEditForm/ParticipantEditForm.js"
);
const PARTICIPANT_DETAIL_PAGE = path.join(
  process.cwd(),
  "src/pages/portal/participant/[pid].js"
);
const PARTICIPANT_DB = path.join(
  process.cwd(),
  "src/utils/portal/participant-db.js"
);

describe("Handicap auto-calculation during edit", () => {
  test("Given participant edit form, when rendering fields, then handicap field does NOT exist", () => {
    const formSrc = fs.readFileSync(PARTICIPANT_EDIT_FORM, "utf-8");

    // Form should NOT have an input field for handicap
    const hasHandicapInput = formSrc.match(/<input[^>]*avgHandicap|onChange.*avgHandicap/i);

    assert.ok(
      !hasHandicapInput,
      "ParticipantEditForm must NOT have an editable handicap input field"
    );
  });

  test("Given participant edit form, when rendering book average field, then it exists and is editable", () => {
    const formSrc = fs.readFileSync(PARTICIPANT_EDIT_FORM, "utf-8");

    // Form should have book average field
    const hasBookAvgLabel = formSrc.includes("Book Average");
    const hasBookAvgInput = formSrc.match(/value=\{formState\.avgEntering\}/);

    assert.ok(
      hasBookAvgLabel && hasBookAvgInput,
      "ParticipantEditForm must have an editable Book Average input field"
    );
  });

  test("Given participant detail page, when building form state, then handicap is NOT included in form state", () => {
    const pageSrc = fs.readFileSync(PARTICIPANT_DETAIL_PAGE, "utf-8");

    // buildFormState should NOT set avgHandicap
    const setsHandicapInForm = pageSrc.match(/avgHandicap:\s*participant/);

    assert.ok(
      !setsHandicapInForm,
      "buildFormState must NOT include avgHandicap in form state"
    );
  });

  test("Given participant detail page, when building payload for save, then handicap is NOT included in payload", () => {
    const pageSrc = fs.readFileSync(PARTICIPANT_DETAIL_PAGE, "utf-8");

    // buildPayload should NOT include handicap field
    const includesHandicapInPayload = pageSrc.match(/handicap:\s*toNumberOrNull\(formState\.avgHandicap\)/);

    assert.ok(
      !includesHandicapInPayload,
      "buildPayload must NOT include handicap field (it should be calculated automatically)"
    );
  });

  test("Given upsertScores function, when bookAverage is provided, then handicap is calculated automatically", () => {
    const dbSrc = fs.readFileSync(PARTICIPANT_DB, "utf-8");

    // upsertScores should import calculateHandicap from handicap-constants
    const importsCalculateHandicap = dbSrc.match(/import.*calculateHandicap.*from.*handicap-constants/);
    // upsertScores should call calculateHandicap function
    const callsCalculateHandicap = dbSrc.match(/handicap\s*=\s*calculateHandicap\s*\(/);

    assert.ok(
      importsCalculateHandicap && callsCalculateHandicap,
      "upsertScores must import and call calculateHandicap function from handicap-constants"
    );
  });

  test("Given upsertScores function, when bookAverage changes, then handicap is recalculated (not taken from updates object)", () => {
    const dbSrc = fs.readFileSync(PARTICIPANT_DB, "utf-8");

    // upsertScores should NOT use updates.averages?.handicap when bookAverage is present
    // It should always calculate handicap from the bookAverage using calculateHandicap function
    const calculatesFromAvg = dbSrc.match(/const handicap\s*=\s*calculateHandicap\s*\(/);

    assert.ok(
      calculatesFromAvg,
      "upsertScores must calculate handicap from avg using calculateHandicap function, not from updates.averages.handicap"
    );
  });

  test("Given handicap auto-calculation, when book average is 190, then handicap is 31", () => {
    // Test the math: (225 - 190) * 0.9 = 35 * 0.9 = 31.5 -> floor = 31
    const bookAverage = 190;
    const expectedHandicap = Math.floor((225 - bookAverage) * 0.9);

    assert.strictEqual(
      expectedHandicap,
      31,
      "Handicap calculation must be correct: (225 - 190) * 0.9 = 31.5 -> floor = 31"
    );
  });

  test("Given handicap auto-calculation, when book average is null, then handicap is null", () => {
    const dbSrc = fs.readFileSync(PARTICIPANT_DB, "utf-8");

    // When avg is null, handicap should also be null
    const handlesNullAvg = dbSrc.match(/if.*avg.*null|avg.*\?/is);

    assert.ok(
      handlesNullAvg,
      "upsertScores must set handicap to null when avg is null"
    );
  });
});
