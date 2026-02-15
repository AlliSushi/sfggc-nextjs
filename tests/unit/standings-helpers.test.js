import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  sortByNumericFieldAndName,
  addRanks,
} from "../../src/utils/portal/standings-helpers.js";

describe("standings-helpers", () => {
  it("Given totals with ties and nulls, when sorting by key, then rows sort desc by score and tie-break by name", () => {
    const rows = [
      { name: "Charlie", total: null },
      { name: "Bravo", total: 900 },
      { name: "Alpha", total: 900 },
      { name: "Delta", total: 870 },
    ];

    rows.sort(sortByNumericFieldAndName("total"));

    assert.deepStrictEqual(
      rows.map((row) => row.name),
      ["Alpha", "Bravo", "Delta", "Charlie"]
    );
  });

  it("Given standings rows, when addRanks runs, then 1-based ranks are assigned in order", () => {
    const rows = [{ name: "A" }, { name: "B" }, { name: "C" }];
    addRanks(rows);
    assert.deepStrictEqual(
      rows.map((row) => row.rank),
      [1, 2, 3]
    );
  });
});
