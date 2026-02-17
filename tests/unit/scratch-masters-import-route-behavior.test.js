const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

let isScratchMastersImportClientError = () => false;
let safeLogScratchMastersImportAction = async () => false;

describe("scratch masters import route behavior", async () => {
  const mod = await import("../../src/pages/api/portal/admin/scratch-masters/import.js");
  isScratchMastersImportClientError = mod.isScratchMastersImportClientError;
  safeLogScratchMastersImportAction = mod.safeLogScratchMastersImportAction;

  it("Given known import validation errors, when classifying, then they are treated as HTTP 400 client errors", () => {
    assert.equal(
      isScratchMastersImportClientError(new Error("No participants matched. Nothing to import.")),
      true
    );
    assert.equal(
      isScratchMastersImportClientError(
        new Error('Bowler "Joe Bishop" has conflicting duplicate rows; import blocked.')
      ),
      true
    );
  });

  it("Given unknown SQL failure, when classifying import error, then it is treated as server error", () => {
    assert.equal(
      isScratchMastersImportClientError(new Error("Unknown column 'updated_at' in 'field list'")),
      false
    );
  });

  it("Given admin action logging fails, when safe logging runs, then import flow does not throw", async () => {
    const ok = await safeLogScratchMastersImportAction(
      "admin@example.com",
      { matched: 3, unmatched: 0, warnings: 0, updated: 2, unchanged: 1 },
      async () => ({ rows: [] }),
      async () => {
        throw new Error("admin_actions table missing");
      }
    );
    assert.equal(ok, false);
  });
});
