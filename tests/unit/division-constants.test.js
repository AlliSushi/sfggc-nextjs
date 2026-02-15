import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDivisionFromAverage } from "../../src/utils/portal/division-constants.js";

describe("getDivisionFromAverage", () => {
  it("Given average 208 or higher, when resolved, then division is A", () => {
    assert.equal(getDivisionFromAverage(208), "A");
    assert.equal(getDivisionFromAverage(250), "A");
  });

  it("Given average 190-207, when resolved, then division is B", () => {
    assert.equal(getDivisionFromAverage(190), "B");
    assert.equal(getDivisionFromAverage(207), "B");
  });

  it("Given average 170-189, when resolved, then division is C", () => {
    assert.equal(getDivisionFromAverage(170), "C");
    assert.equal(getDivisionFromAverage(189), "C");
  });

  it("Given average 150-169, when resolved, then division is D", () => {
    assert.equal(getDivisionFromAverage(150), "D");
    assert.equal(getDivisionFromAverage(169), "D");
  });

  it("Given average 149 or lower, when resolved, then division is E", () => {
    assert.equal(getDivisionFromAverage(149), "E");
    assert.equal(getDivisionFromAverage(120), "E");
  });

  it("Given null/invalid average, when resolved, then division is null", () => {
    assert.equal(getDivisionFromAverage(null), null);
    assert.equal(getDivisionFromAverage(undefined), null);
    assert.equal(getDivisionFromAverage(""), null);
    assert.equal(getDivisionFromAverage("abc"), null);
  });
});
