const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RESULTS_PAGE_PATH = path.join(process.cwd(), "src/pages/results.js");
const RESULTS_COMPONENT_PATH = path.join(process.cwd(), "src/components/Results/Results.js");

const read = (filePath) => fs.readFileSync(filePath, "utf8");

test("Given results page route, when checking source, then it fetches visibility flags client-side and passes them to Results component", () => {
  const page = read(RESULTS_PAGE_PATH);
  assert.ok(
    page.includes("/api/portal/admin/scores/visibility"),
    "Results page should fetch scores visibility from API"
  );
  assert.ok(
    page.includes("/api/portal/admin/optional-events/visibility"),
    "Results page should fetch optional events visibility from API"
  );
  assert.ok(
    page.includes("showStandingsLink"),
    "Results page should track standings link visibility state"
  );
  assert.ok(
    page.includes("showOptionalEventsLink"),
    "Results page should track optional events link visibility state"
  );
});

test("Given results component, when checking source, then standings and optional-events buttons render only when visibility props are enabled", () => {
  const component = read(RESULTS_COMPONENT_PATH);
  assert.ok(
    component.includes("showStandingsLink &&"),
    "Results component should conditionally render standings button"
  );
  assert.ok(
    component.includes("showOptionalEventsLink &&"),
    "Results component should conditionally render optional events button"
  );
  assert.ok(
    component.includes("View Overall Standings"),
    "Results component should include a View Overall Standings button label"
  );
  assert.ok(
    component.includes("View Optional Events"),
    "Results component should include a View Optional Events button label"
  );
  assert.ok(
    component.includes("RESULTS_FROM_QUERY") &&
      component.includes("/portal/scores?from=${RESULTS_FROM_QUERY}"),
    "Results component should link to standings with from=/results"
  );
  assert.ok(
    component.includes("/portal/admin/optional-events?from=${RESULTS_FROM_QUERY}"),
    "Results component should link to optional events with from=/results"
  );
  assert.ok(
    component.includes("d-flex") && component.includes("gap-3"),
    "Results component should use flexbox layout with gap for portal action buttons"
  );
  assert.ok(
    component.includes("btn-primary"),
    "Results component should style portal action buttons as primary CTAs for clear contrast"
  );
  assert.ok(
    !component.includes("btn-outline-primary"),
    "Results component should avoid outline-primary for these CTAs to prevent low-contrast rendering"
  );
});
