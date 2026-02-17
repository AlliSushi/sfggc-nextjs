import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateHandicap } from "../../src/utils/portal/handicap-constants.js";

describe("handicap cap behavior", () => {
  it("Given a book average of 225, when calculating handicap, then handicap is 0", () => {
    assert.equal(calculateHandicap(225), 0);
  });

  it("Given a book average greater than 225, when calculating handicap, then handicap is 0", () => {
    assert.equal(calculateHandicap(230), 0);
    assert.equal(calculateHandicap(300), 0);
  });
});
