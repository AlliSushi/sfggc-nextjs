const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

let applyOptionalEventsUpdates = async () => {
  throw new Error("not implemented");
};
let isOptionalEventsImportClientError = () => false;
let safeLogOptionalEventsImportAction = async () => false;

describe("optional events import route behavior", async () => {
  const mod = await import("../../src/pages/api/portal/admin/optional-events/import.js");
  applyOptionalEventsUpdates = mod.applyOptionalEventsUpdates;
  isOptionalEventsImportClientError = mod.isOptionalEventsImportClientError;
  safeLogOptionalEventsImportAction = mod.safeLogOptionalEventsImportAction;

  it("Given updated_at column is unavailable, when applying updates, then SQL omits updated_at assignment", async () => {
    const updates = [
      {
        pid: "1001",
        optionalBest3Of9: 1,
        optionalScratch: 0,
        optionalAllEventsHdcp: 1,
        optionalEvents: 1,
      },
    ];

    const executedSql = [];
    const connQuery = async (sql) => {
      if (sql.includes("from people")) {
        return {
          rows: [
            {
              optional_events: 0,
              optional_best_3_of_9: 0,
              optional_scratch: 0,
              optional_all_events_hdcp: 0,
            },
          ],
        };
      }
      executedSql.push(sql);
      return { rows: [] };
    };

    const result = await applyOptionalEventsUpdates(updates, connQuery, {
      optional_events: true,
      optional_best_3_of_9: true,
      optional_scratch: true,
      optional_all_events_hdcp: true,
      updated_at: false,
    });

    assert.equal(result.updated, 1);
    assert.equal(result.unchanged, 0);
    assert.equal(executedSql.length, 1);
    assert.ok(!executedSql[0].includes("updated_at = now()"));
  });

  it("Given preview values are unchanged, when applying updates, then no update statement is executed", async () => {
    let updateCount = 0;
    const connQuery = async (sql) => {
      if (sql.includes("from people")) {
        return {
          rows: [
            {
              optional_events: 1,
              optional_best_3_of_9: 1,
              optional_scratch: 0,
              optional_all_events_hdcp: 1,
            },
          ],
        };
      }
      if (sql.startsWith("update people")) {
        updateCount += 1;
      }
      return { rows: [] };
    };

    const result = await applyOptionalEventsUpdates(
      [
        {
          pid: "1001",
          optionalBest3Of9: 1,
          optionalScratch: 0,
          optionalAllEventsHdcp: 1,
          optionalEvents: 1,
        },
      ],
      connQuery,
      {
        optional_events: true,
        optional_best_3_of_9: true,
        optional_scratch: true,
        optional_all_events_hdcp: true,
        updated_at: true,
      }
    );

    assert.equal(result.updated, 0);
    assert.equal(result.unchanged, 1);
    assert.equal(updateCount, 0);
  });

  it("Given no-participants and duplicate-row validation errors, when classifying, then they return HTTP 400 client errors", () => {
    assert.equal(
      isOptionalEventsImportClientError(new Error("No participants matched. Nothing to import.")),
      true
    );
    assert.equal(
      isOptionalEventsImportClientError(
        new Error('EID "1234" has conflicting duplicate rows; import blocked.')
      ),
      true
    );
  });

  it("Given unknown SQL failure, when classifying import error, then it is treated as server error", () => {
    assert.equal(
      isOptionalEventsImportClientError(new Error("Unknown column 'updated_at' in 'field list'")),
      false
    );
    assert.equal(
      isOptionalEventsImportClientError(
        new Error("Optional Events columns missing (optional_scratch). Run scripts/dev/run-portal-migrations.sh and restart the server.")
      ),
      false
    );
  });

  it("Given admin action logging fails, when safe logging runs, then import flow does not throw", async () => {
    const ok = await safeLogOptionalEventsImportAction(
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
