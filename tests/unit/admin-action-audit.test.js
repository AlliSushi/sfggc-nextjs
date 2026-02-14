const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const loadAuditUtils = async () => {
  const fullPath = path.join(process.cwd(), "src/utils/portal/audit.js");
  return import(pathToFileURL(fullPath));
};

test(
  "Given admin action details object, when logging admin action, then one insert is executed with serialized details",
  async () => {
    const { logAdminAction } = await loadAuditUtils();
    const calls = [];
    const mockQuery = async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    };

    await logAdminAction(
      "admin@example.com",
      "import_lanes",
      { updated: 3, skipped: 1 },
      mockQuery
    );

    assert.equal(calls.length, 1, "Expected one admin_actions insert query");
    assert.ok(
      calls[0].sql.toLowerCase().includes("insert into admin_actions"),
      "Expected query to insert into admin_actions"
    );
    assert.equal(calls[0].params[1], "admin@example.com");
    assert.equal(calls[0].params[2], "import_lanes");
    assert.equal(calls[0].params[3], JSON.stringify({ updated: 3, skipped: 1 }));
  }
);

test(
  "Given null admin action details, when logging admin action, then details are normalized to empty string",
  async () => {
    const { logAdminAction } = await loadAuditUtils();
    const calls = [];
    const mockQuery = async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    };

    await logAdminAction("admin@example.com", "import_xml", null, mockQuery);

    assert.equal(calls.length, 1, "Expected one admin_actions insert query");
    assert.equal(calls[0].params[3], "", "Null details should be normalized to empty string");
  }
);
