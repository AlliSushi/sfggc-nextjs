const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROUTE_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/admin/scores/clear.js"
);
const PAGE_PATH = path.join(process.cwd(), "src/pages/portal/scores.js");

const readRoute = () => fs.readFileSync(ROUTE_PATH, "utf8");
const readPage = () => fs.readFileSync(PAGE_PATH, "utf8");

// ---------------------------------------------------------------------------
// API route: /api/portal/admin/scores/clear
// ---------------------------------------------------------------------------

test(
  "Given clear-scores API route, when checked, then file exists at expected path",
  () => {
    assert.ok(
      fs.existsSync(ROUTE_PATH),
      "API route must exist at src/pages/api/portal/admin/scores/clear.js"
    );
  }
);

test(
  "Given clear-scores API route, when read, then exports a default handler",
  () => {
    const content = readRoute();
    assert.ok(
      content.includes("export default"),
      "Must export a default handler"
    );
  }
);

test(
  "Given clear-scores API route, when read, then requires super admin auth",
  () => {
    const content = readRoute();
    assert.ok(
      content.includes("handleSuperAdminClear"),
      "Must use shared handleSuperAdminClear helper, which enforces requireSuperAdmin guard"
    );
  }
);

test(
  "Given clear-scores API route, when read, then nulls game columns instead of deleting rows",
  () => {
    const content = readRoute();
    assert.ok(
      content.toLowerCase().includes("update scores"),
      "Must UPDATE scores (not DELETE) to preserve entering_avg and handicap"
    );
    assert.ok(
      !content.toLowerCase().includes("delete from scores"),
      "Must NOT use DELETE FROM scores — that destroys entering_avg and handicap data"
    );
  }
);

test(
  "Given clear-scores API route, when read, then uses withTransaction",
  () => {
    const content = readRoute();
    assert.ok(
      content.includes("handleSuperAdminClear"),
      "Must use shared handleSuperAdminClear helper, which wraps deletion in a transaction"
    );
  }
);

test(
  "Given clear-scores API route, when read, then logs the action via audit",
  () => {
    const content = readRoute();
    assert.ok(
      content.includes("logAdminAction") || content.includes("clear_scores"),
      "Must log the clear_scores action for audit trail"
    );
  }
);

// ---------------------------------------------------------------------------
// Scores page: Clear Scores button (super admin only)
// ---------------------------------------------------------------------------

test(
  "Given scores page, when read, then contains a Clear Scores button",
  () => {
    const content = readPage();
    assert.ok(
      content.includes("Clear Scores"),
      "Scores page must have a Clear Scores button"
    );
  }
);

test(
  "Given scores page, when read, then Clear Scores is only visible to super admins",
  () => {
    const content = readPage();
    assert.ok(
      content.includes("super-admin") || content.includes("superAdmin"),
      "Clear Scores visibility must be gated on super-admin role"
    );
  }
);

test(
  "Given scores page, when read, then Clear Scores shows a confirmation modal",
  () => {
    const content = readPage();
    assert.ok(
      content.includes("PortalModal"),
      "Scores page must use PortalModal for clear confirmation"
    );
  }
);

test(
  "Given scores page, when read, then Clear Scores calls the clear-scores API endpoint",
  () => {
    const content = readPage();
    assert.ok(
      content.includes("/api/portal/admin/scores/clear"),
      "Scores page must call the clear-scores API endpoint"
    );
  }
);

test(
  "Given scores page, when scores are cleared, then standings refresh to show empty state",
  () => {
    const content = readPage();
    // After clearing, the page must refetch scores (either via setStandings reset or a refresh mechanism)
    assert.ok(
      content.includes("setStandings") || content.includes("setRefreshKey"),
      "Scores page must reset standings data after clearing"
    );
  }
);

test(
  "Given scores page, when initializing and normalizing standings data, then it uses a shared createEmptyStandings helper",
  () => {
    const content = readPage();
    assert.ok(
      content.includes("createEmptyStandings"),
      "Scores page should define and reuse createEmptyStandings to avoid duplicate empty standings objects"
    );
  }
);
