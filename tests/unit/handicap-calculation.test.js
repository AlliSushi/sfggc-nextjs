const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("node:url");

const IMPORT_SCRIPT = path.join(
  process.cwd(),
  "src/utils/portal/importIgboXml.js"
);
const PARTICIPANT_LIST_API = path.join(
  process.cwd(),
  "src/pages/api/portal/participants/index.js"
);
const PARTICIPANT_DB = path.join(
  process.cwd(),
  "src/utils/portal/participant-db.js"
);
const HANDICAP_CONSTANTS = path.join(
  process.cwd(),
  "src/utils/portal/handicap-constants.js"
);
const loadHandicapConstants = async () => import(pathToFileURL(HANDICAP_CONSTANTS));

describe("Handicap calculation and display", () => {
  test("Given handicap-constants module, when examining formula, then it uses USBC standard: floor((225 - book_average) * 0.9)", () => {
    const constantsSrc = fs.readFileSync(HANDICAP_CONSTANTS, "utf-8");

    // Constants module should define the base score and multiplier
    const hasBaseScore = constantsSrc.includes("225");
    const hasMultiplier = constantsSrc.includes("0.9");
    const usesFloor = constantsSrc.includes("Math.floor");

    assert.ok(
      hasBaseScore && hasMultiplier && usesFloor,
      "handicap-constants.js must define formula as floor((225 - bookAverage) * 0.9)"
    );
  });

  test("Given XML import, when calculating handicap, then it uses calculateHandicap from handicap-constants", () => {
    const importSrc = fs.readFileSync(IMPORT_SCRIPT, "utf-8");

    // Import script should use calculateHandicap function from handicap-constants
    const importsCalculateHandicap = importSrc.includes("import") && importSrc.includes("calculateHandicap");
    const usesCalculateHandicap = importSrc.includes("calculateHandicap(");

    assert.ok(
      importsCalculateHandicap && usesCalculateHandicap,
      "Import script must import and use calculateHandicap from handicap-constants.js"
    );
  });

  test("Given XML import with book average, when building import rows, then handicap is calculated and included", () => {
    const importSrc = fs.readFileSync(IMPORT_SCRIPT, "utf-8");

    // buildImportRows should calculate handicap for each score
    const setsHandicap = importSrc.match(/handicap.*225|handicap.*bookAvg/is);

    assert.ok(
      setsHandicap,
      "buildImportRows must calculate and set handicap for scores"
    );
  });

  test("Given participant list API, when returning participants, then handicap is included from scores table", () => {
    const apiSrc = fs.readFileSync(PARTICIPANT_LIST_API, "utf-8");

    // Query should select handicap similar to how it selects book_average
    const selectsHandicap = apiSrc.match(/select.*handicap/is);

    assert.ok(
      selectsHandicap,
      "participants/index.js must SELECT handicap from scores table"
    );
  });

  test("Given formatParticipant function, when formatting data, then handicap is already returned in averages", () => {
    const dbSrc = fs.readFileSync(PARTICIPANT_DB, "utf-8");

    // formatParticipant already returns averages.handicap
    const returnsHandicap = dbSrc.match(/averages:[\s\S]{0,200}handicap:/);

    assert.ok(
      returnsHandicap,
      "formatParticipant must return handicap in averages object"
    );
  });

  test("Given upsertScores function, when saving scores, then handicap is saved to database", () => {
    const dbSrc = fs.readFileSync(PARTICIPANT_DB, "utf-8");

    // upsertScores should INSERT/UPDATE handicap in scores table
    const insertsHandicap = dbSrc.match(/insert into scores[\s\S]{0,500}handicap/i);
    const updatesHandicap = dbSrc.match(/handicap = values\(handicap\)/i);

    assert.ok(
      insertsHandicap && updatesHandicap,
      "upsertScores must INSERT and UPDATE handicap in scores table"
    );
  });

  test("Given handicap calculation, when book average is 180, then handicap is 40", async () => {
    const { calculateHandicap } = await loadHandicapConstants();
    assert.strictEqual(calculateHandicap(180), 40);
  });

  test("Given handicap calculation, when book average is 200, then handicap is 22", async () => {
    const { calculateHandicap } = await loadHandicapConstants();
    assert.strictEqual(calculateHandicap(200), 22);
  });

  test("Given handicap calculation, when book average exceeds 225, then handicap is capped at 0", async () => {
    const { calculateHandicap } = await loadHandicapConstants();
    assert.strictEqual(calculateHandicap(230), 0);
  });

  test("Given handicap calculation, when book average is null, then handicap is null", () => {
    const importSrc = fs.readFileSync(IMPORT_SCRIPT, "utf-8");

    // Import should handle null/missing book averages
    const handlesNull = importSrc.match(/if.*bookAvg|bookAvg.*null|\?\?/is);

    assert.ok(
      handlesNull,
      "Import script must handle null book averages gracefully"
    );
  });

  test("Given XML with attributes, when parsing BOOK_AVERAGE, then it extracts #text property", () => {
    const importSrc = fs.readFileSync(IMPORT_SCRIPT, "utf-8");

    // XML parser treats <BOOK_AVERAGE verified="YES">170</BOOK_AVERAGE> as { '#text': 170, '@_verified': 'YES' }
    // Import must extract the #text property
    const extractsText = importSrc.match(/BOOK_AVERAGE.*\['#text'\]|BOOK_AVERAGE.*#text/);

    assert.ok(
      extractsText,
      "Import script must extract #text property from BOOK_AVERAGE when XML has attributes"
    );
  });

  test("Given XML BOOK_AVERAGE extraction, when element has attributes, then it uses optional chaining for safety", () => {
    const importSrc = fs.readFileSync(IMPORT_SCRIPT, "utf-8");

    // Should use optional chaining (?.) and nullish coalescing (??) for backward compatibility
    const usesOptionalChaining = importSrc.match(/BOOK_AVERAGE\?\.\['#text'\]\s*\?\?/);

    assert.ok(
      usesOptionalChaining,
      "Import script must use optional chaining (?.) and nullish coalescing (??) when extracting #text"
    );
  });
});
