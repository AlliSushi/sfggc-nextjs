const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PAGE_PATH = path.join(
  process.cwd(),
  "src/pages/portal/admin/lane-assignments.js"
);

const readPage = () => fs.readFileSync(PAGE_PATH, "utf8");

test(
  "Given lane assignments page source, when checked, then it formats each matchup as a lane pair label",
  () => {
    const content = readPage();
    assert.ok(
      content.includes("formatLanePairLabel"),
      "Lane assignments page must define a helper to render lane pair labels"
    );
    assert.ok(
      content.includes("Lanes ${lane} & ${lane + 1}"),
      "Lane pair helper must format labels as `Lanes 1 & 2`, `Lanes 3 & 4`, etc."
    );
  }
);

test(
  "Given lane assignments page source, when rendering rows for team, doubles, and singles tabs, then it displays lane pair labels instead of single odd-lane labels",
  () => {
    const content = readPage();
    assert.ok(
      content.includes("{formatLanePairLabel(row.lane)}"),
      "Lane column must render lane pair labels for all event tabs"
    );
    assert.ok(
      !content.includes("Lane {row.lane}"),
      "Lane column must not render single-lane labels like `Lane 1`"
    );
  }
);
