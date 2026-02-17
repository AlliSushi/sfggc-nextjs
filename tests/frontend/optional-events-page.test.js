const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PAGE_PATH = path.join(
  process.cwd(),
  "src/pages/portal/admin/optional-events.js"
);
const API_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/admin/optional-events.js"
);
const VISIBILITY_API_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/admin/optional-events/visibility.js"
);
const IMPORT_API_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/admin/optional-events/import.js"
);
const IMPORT_MODAL_PATH = path.join(
  process.cwd(),
  "src/components/Portal/ImportOptionalEventsModal/ImportOptionalEventsModal.js"
);

const read = (p) => fs.readFileSync(p, "utf8");

test("Given optional events feature, when checking file system, then page and API routes exist", () => {
  assert.ok(
    fs.existsSync(PAGE_PATH),
    "Optional events page must exist at src/pages/portal/admin/optional-events.js"
  );
  assert.ok(
    fs.existsSync(API_PATH),
    "Optional events API must exist at src/pages/api/portal/admin/optional-events.js"
  );
  assert.ok(
    fs.existsSync(VISIBILITY_API_PATH),
    "Optional events visibility API must exist at src/pages/api/portal/admin/optional-events/visibility.js"
  );
  assert.ok(
    fs.existsSync(IMPORT_API_PATH),
    "Optional events import API must exist at src/pages/api/portal/admin/optional-events/import.js"
  );
});

test("Given optional events page, when checking source, then it uses visibility SSR guard and admin toggle", () => {
  const page = read(PAGE_PATH);
  assert.ok(
    page.includes("requireSessionWithVisibilitySSR"),
    "Optional events page should use shared visibility SSR helper"
  );
  assert.ok(
    page.includes("getOptionalEventsVisibleToParticipants"),
    "Optional events page SSR should read optional events visibility setting"
  );
  assert.ok(
    page.includes("/api/portal/admin/optional-events/visibility"),
    "Optional events page should call optional events visibility API endpoint"
  );
  assert.ok(
    page.includes('participantsCanViewOptionalEvents ? "On" : "Off"'),
    "Optional events page should render On/Off label"
  );
  assert.ok(
    page.includes("/api/portal/admin/optional-events/import"),
    "Optional events page should call import API endpoint"
  );
  assert.ok(
    page.includes("Optional Events import complete"),
    "Optional events page should show import completion summary"
  );
  assert.ok(
    page.includes("allowPublicWhenVisible: true"),
    "Optional events page SSR should allow public access when optional events visibility is enabled"
  );
  assert.ok(
    page.includes("useCallback"),
    "Optional events page should memoize loadOptionalEvents for stable useEffect dependencies"
  );
  assert.ok(
    page.includes("useRouter"),
    "Optional events page should read router query so a Back button can return users to their previous page"
  );
  assert.ok(
    page.includes("normalizeQueryValue(router.query.from)"),
    "Optional events page should normalize the from query param"
  );
  assert.ok(
    page.includes("resolveBackHref"),
    "Optional events page should resolve a safe back href from query state"
  );
  assert.ok(
    page.includes("Back") && page.includes("btn btn-outline-secondary"),
    "Optional events page should render a Back button when from query param is present"
  );
  assert.ok(
    page.includes("from || isAdmin") &&
      page.includes('className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4"'),
    "Optional events page should render a shared controls row so Back aligns with admin controls"
  );
  assert.match(
    page,
    /useEffect\(\(\)\s*=>\s*\{\s*loadOptionalEvents\(\);\s*\},\s*\[loadOptionalEvents\]\s*\)/s,
    "Optional events page useEffect should depend on loadOptionalEvents"
  );
});

test("Given optional events page controls, when rendered for admins, then Import CSV appears before the On/Off toggle", () => {
  const page = read(PAGE_PATH);
  const importIndex = page.indexOf("Import Optional Events");
  const toggleIndex = page.indexOf('participantsCanViewOptionalEvents ? "On" : "Off"');
  assert.ok(importIndex >= 0, "Optional events page should render Import Optional Events control");
  assert.ok(toggleIndex >= 0, "Optional events page should render On/Off toggle");
  assert.ok(importIndex < toggleIndex, "Import Optional Events control should appear before On/Off toggle");
});

test("Given optional events page, when rendering sections, then it includes top lists with expand/hide controls", () => {
  const page = read(PAGE_PATH);
  const modal = read(IMPORT_MODAL_PATH);
  assert.ok(page.includes("Best of 3 of 9"), "Page should include Best of 3 of 9 section");
  assert.ok(page.includes("All Events Handicapped"), "Page should include All Events Handicapped section");
  assert.ok(page.includes("Optional Scratch"), "Page should include Optional Scratch section");
  assert.ok(page.includes("Show all"), "Page should include Show all control");
  assert.ok(page.includes("Hide list"), "Page should include Hide list control");
  assert.ok(
    modal.includes("No participants matched this CSV"),
    "Import modal should show clear no-match message and prevent apply"
  );
});

test("Given optional events API, when checking source, then it enforces optional-events participant filter", () => {
  const api = read(API_PATH);
  assert.ok(
    api.includes("p.optional_best_3_of_9 = 1") &&
      api.includes("p.optional_scratch = 1") &&
      api.includes("p.optional_all_events_hdcp = 1"),
    "Optional events API should include per-event participation filter clauses"
  );
  assert.ok(
    api.includes("getOptionalEventsVisibleToParticipants"),
    "Optional events API should enforce participant visibility setting"
  );
  assert.ok(
    api.includes("getAuthSessions"),
    "Optional events API should read sessions without immediately rejecting anonymous users"
  );
  assert.ok(
    api.includes("unauthorized(res)"),
    "Optional events API should return unauthorized when no session exists and visibility is disabled"
  );
  assert.ok(
    !api.includes("requireAnySession"),
    "Optional events API should not force session auth before checking visibility for public results access"
  );
});
