const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PARTICIPANT_PAGE = path.join(process.cwd(), "src/pages/portal/participant/[pid].js");
const PARTICIPANT_PROFILE = path.join(
  process.cwd(),
  "src/components/Portal/ParticipantProfile/ParticipantProfile.js"
);
const PARTICIPANT_SSR = path.join(process.cwd(), "src/utils/portal/participant-page-ssr.js");

const read = (p) => fs.readFileSync(p, "utf8");

test("Given participant pages, when checking source, then optional events visibility is wired from SSR to profile CTA", () => {
  const page = read(PARTICIPANT_PAGE);
  const profile = read(PARTICIPANT_PROFILE);
  const ssr = read(PARTICIPANT_SSR);

  assert.ok(
    ssr.includes("getOptionalEventsVisibleToParticipants"),
    "Participant SSR must fetch optional-events visibility setting"
  );
  assert.ok(
    page.includes("optionalEventsVisibleToParticipants"),
    "Participant page should carry optional-events visibility prop"
  );
  assert.ok(
    page.includes("showOptionalEventsLink={isAdmin || optionalEventsVisibleToParticipants}"),
    "Participant page should pass Optional Events visibility to profile action"
  );
  assert.ok(
    profile.includes("View Optional Events"),
    "Participant profile should expose View Optional Events CTA"
  );
});

