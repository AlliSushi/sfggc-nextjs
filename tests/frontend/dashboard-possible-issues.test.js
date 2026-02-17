const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DASHBOARD_PATH = path.join(
  process.cwd(),
  "src/pages/portal/admin/dashboard.js"
);
const POSSIBLE_ISSUES_CARD_PATH = path.join(
  process.cwd(),
  "src/components/Portal/PossibleIssuesCard/PossibleIssuesCard.js"
);

test("Given admin dashboard source, when checking section labels, then Possible Issues heading is present", () => {
  const src = fs.readFileSync(POSSIBLE_ISSUES_CARD_PATH, "utf8");
  assert.ok(
    src.includes("Possible Issues"),
    "PossibleIssuesCard should render a Possible Issues section heading"
  );
});

test("Given admin dashboard source, when loading data, then it fetches possible issues from API", () => {
  const src = fs.readFileSync(DASHBOARD_PATH, "utf8");
  assert.ok(
    src.includes("/api/portal/admin/possible-issues"),
    "Dashboard should call the possible-issues API endpoint"
  );
});

test("Given admin dashboard source, when rendering issue rows, then it shows linked participant details", () => {
  const src = fs.readFileSync(POSSIBLE_ISSUES_CARD_PATH, "utf8");
  assert.ok(
    src.includes("issue.details") && src.includes("relatedParticipants") && src.includes("/portal/participant/"),
    "PossibleIssuesCard should render per-issue detail rows with participant links"
  );
});

test("Given admin dashboard source, when rendering possible issues, then it delegates rendering to PossibleIssuesCard", () => {
  const src = fs.readFileSync(DASHBOARD_PATH, "utf8");
  assert.ok(
    src.includes("import PossibleIssuesCard") && src.includes("<PossibleIssuesCard possibleIssues={possibleIssues} />"),
    "Dashboard should delegate possible issues rendering to PossibleIssuesCard"
  );
});
