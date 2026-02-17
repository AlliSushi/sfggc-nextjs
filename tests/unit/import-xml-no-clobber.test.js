import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildImportRows } from "../../src/utils/portal/importIgboXml.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMPORT_XML_PATH = path.join(
  __dirname,
  "../../src/utils/portal/importIgboXml.js"
);

// ---------------------------------------------------------------------------
// buildImportRows — score rows always have null lane/game fields
// ---------------------------------------------------------------------------

describe("buildImportRows score fields", () => {
  it("Given a person with book average, when buildImportRows runs, then score rows have null lane and game fields", () => {
    const people = [
      {
        ID: "100",
        FIRST_NAME: "Alice",
        LAST_NAME: "Smith",
        BOOK_AVERAGE: "180",
      },
    ];

    const { scores } = buildImportRows(people);

    assert.ok(scores.length > 0, "Expected at least one score row");
    for (const score of scores) {
      assert.strictEqual(score.lane, null, `lane should be null for ${score.event_type}`);
      assert.strictEqual(score.game1, null, `game1 should be null for ${score.event_type}`);
      assert.strictEqual(score.game2, null, `game2 should be null for ${score.event_type}`);
      assert.strictEqual(score.game3, null, `game3 should be null for ${score.event_type}`);
    }
  });

  it("Given a person with book average, when buildImportRows runs, then entering_avg and handicap are populated", () => {
    const people = [
      {
        ID: "100",
        FIRST_NAME: "Alice",
        LAST_NAME: "Smith",
        BOOK_AVERAGE: "180",
      },
    ];

    const { scores } = buildImportRows(people);

    for (const score of scores) {
      assert.strictEqual(score.entering_avg, 180, `entering_avg should be 180 for ${score.event_type}`);
      assert.ok(score.handicap !== null, `handicap should not be null for ${score.event_type}`);
    }
  });
});

// ---------------------------------------------------------------------------
// SQL source analysis — COALESCE for nullable fields
// ---------------------------------------------------------------------------

/** Check if source contains a COALESCE(VALUES(col), col) pattern (case-insensitive). */
const hasCoalesceGuard = (source, column) => {
  const pattern = `coalesce(values(${column}), ${column})`;
  return source.toLowerCase().includes(pattern);
};

describe("importIgboXml scores upsert SQL", () => {
  const src = fs.readFileSync(IMPORT_XML_PATH, "utf-8");

  it("Given scores upsert SQL, when lane value is null from XML, then SQL uses COALESCE to preserve existing lane", () => {
    assert.ok(
      hasCoalesceGuard(src, "lane"),
      "Scores upsert must use COALESCE(VALUES(lane), lane) to preserve existing lane data"
    );
  });

  it("Given scores upsert SQL, when game values are null from XML, then SQL uses COALESCE to preserve existing game scores", () => {
    for (const field of ["game1", "game2", "game3"]) {
      assert.ok(
        hasCoalesceGuard(src, field),
        `Scores upsert must use COALESCE(VALUES(${field}), ${field}) to preserve existing game scores`
      );
    }
  });

  it("Given scores upsert SQL, when entering_avg has a value, then SQL unconditionally updates entering_avg", () => {
    assert.ok(
      !hasCoalesceGuard(src, "entering_avg"),
      "entering_avg should NOT use COALESCE — it always has a value from XML and should overwrite unconditionally"
    );
  });
});
