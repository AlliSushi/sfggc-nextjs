import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_CSV_SIZE_BYTES,
  IMPORT_MODES,
  isImportMode,
} from "../../src/utils/portal/import-constants.js";
import {
  validateRequiredColumns,
  validateColumnsWithAliases,
  resolveHeader,
  normalizeImportName,
  buildPersonNameIndex,
  wouldClobberExisting,
} from "../../src/utils/portal/import-csv-helpers.js";
import {
  sumNullableValues,
  sumFieldAcrossMembers,
} from "../../src/utils/portal/score-helpers.js";

describe("import-constants", () => {
  it("Given import constants, when read, then max CSV size is 2MB and preview/import modes are defined", () => {
    assert.strictEqual(MAX_CSV_SIZE_BYTES, 2 * 1024 * 1024);
    assert.strictEqual(IMPORT_MODES.PREVIEW, "preview");
    assert.strictEqual(IMPORT_MODES.IMPORT, "import");
  });

  it("Given import mode values, when validated, then only preview/import are accepted", () => {
    assert.strictEqual(isImportMode("preview"), true);
    assert.strictEqual(isImportMode("import"), true);
    assert.strictEqual(isImportMode("other"), false);
    assert.strictEqual(isImportMode(null), false);
  });
});

describe("import-csv-helpers", () => {
  it("Given headers and required columns, when validating, then missing columns are returned", () => {
    const result = validateRequiredColumns(["A", "B"], ["A", "C"]);
    assert.deepStrictEqual(result, { valid: false, missing: ["C"] });
  });

  it("Given null new value and existing old value, when checking clobber guard, then it reports clobber", () => {
    assert.strictEqual(wouldClobberExisting(null, 1), true);
    assert.strictEqual(wouldClobberExisting(null, null), false);
    assert.strictEqual(wouldClobberExisting(1, null), false);
  });

  it("Given aliases, when resolving a header, then the matching alias is returned", () => {
    const header = resolveHeader(["\uFEFFEID", "Last"], "EID", {
      EID: ["EID", "\uFEFFEID"],
    });
    assert.strictEqual(header, "\uFEFFEID");
  });

  it("Given required columns and aliases, when validating, then the mapped headers are returned", () => {
    const result = validateColumnsWithAliases(
      ["Bowler name", "SM"],
      ["Bowler Name", "SM?"],
      {
        "Bowler Name": ["Bowler Name", "Bowler name"],
        "SM?": ["SM?", "SM"],
      }
    );

    assert.deepStrictEqual(result, {
      valid: true,
      missing: [],
      headerMap: {
        "Bowler Name": "Bowler name",
        "SM?": "SM",
      },
    });
  });

  it("Given punctuation and mixed case, when normalizing import names, then punctuation is removed and lowercased", () => {
    assert.strictEqual(normalizeImportName(" O'Connor "), "oconnor");
    assert.strictEqual(normalizeImportName("Joe-Bishop, Jr."), "joebishopjr");
  });

  it("Given people records, when building person name index with nickname+source, then first and nickname keys are both indexed", () => {
    const index = buildPersonNameIndex(
      [
        {
          pid: "P1",
          first_name: "Joseph",
          last_name: "Bishop",
          nickname: "Joe",
        },
      ],
      { includeNickname: true, withSource: true }
    );

    assert.equal(index.get("josephbishop").length, 1);
    assert.equal(index.get("josephbishop")[0].source, "first");
    assert.equal(index.get("joebishop").length, 1);
    assert.equal(index.get("joebishop")[0].source, "nickname");
  });
});

describe("score-helpers", () => {
  it("Given nullable values, when summed, then null-only inputs return null and mixed inputs sum", () => {
    assert.strictEqual(sumNullableValues([null, null]), null);
    assert.strictEqual(sumNullableValues([100, null, 200]), 300);
  });

  it("Given members and a field name, when summing, then only non-null field values are totaled", () => {
    const members = [{ game1: 100 }, { game1: null }, { game1: 125 }];
    assert.strictEqual(sumFieldAcrossMembers(members, "game1"), 225);
  });
});
