const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PAGE_PATH = path.join(process.cwd(), "src/pages/portal/admin/audit.js");

const readPage = () => fs.readFileSync(PAGE_PATH, "utf8");

test(
  "Given the admin audit page, when rendering the filter toolbar, then Clear Log appears between Sort by date and AdminMenu",
  () => {
    const content = readPage();
    const sortIndex = content.indexOf('id="audit-sort"');
    const clearIndex = content.indexOf("Clear Log");
    const menuIndex = content.indexOf("<AdminMenu");

    assert.ok(sortIndex >= 0, "Sort by date select must exist");
    assert.ok(clearIndex >= 0, "Clear Log button must exist");
    assert.ok(menuIndex >= 0, "AdminMenu must exist");
    assert.ok(
      sortIndex < clearIndex && clearIndex < menuIndex,
      "Clear Log button must be rendered between Sort by date controls and AdminMenu"
    );
  }
);

test(
  "Given the admin audit page, when clear is confirmed, then it reloads rows from the API",
  () => {
    const content = readPage();
    assert.ok(
      content.includes("/api/portal/admin/audit/clear"),
      "Audit page must call the clear-audit API endpoint"
    );
    assert.ok(
      content.includes("/api/portal/admin/audit?"),
      "Audit page must fetch audit rows from the audit API endpoint"
    );
    assert.ok(
      content.includes("setRefreshKey"),
      "Audit page must trigger a refetch after clear so the clear action is visible"
    );
  }
);
