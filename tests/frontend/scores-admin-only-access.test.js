const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readFile = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

test(
  "Given the scores page route, when checking SSR guard, then it conditionally allows participants based on scores visibility setting",
  () => {
    const content = readFile("src/pages/portal/scores.js");
    assert.ok(
      content.includes("requireSessionWithVisibilitySSR"),
      "Scores page SSR should use shared visibility SSR helper"
    );
    assert.ok(
      content.includes("getScoresVisibleToParticipants"),
      "Scores page SSR must load participants visibility setting"
    );
    assert.ok(
      content.includes("visibilityPropName: \"initialParticipantsCanViewScores\""),
      "Scores page SSR should pass scores visibility prop name to shared helper"
    );
  }
);

test(
  "Given the scores API route, when checking authorization, then participants are allowed only when visibility is enabled",
  () => {
    const content = readFile("src/pages/api/portal/scores.js");
    assert.ok(
      content.includes("requireAnySession"),
      "Scores API must require a valid portal session"
    );
    assert.ok(
      content.includes("getScoresVisibleToParticipants"),
      "Scores API must read visibility setting for participant access"
    );
    assert.ok(
      content.includes("forbidden(res)"),
      "Scores API must deny participant access when visibility is disabled"
    );
  }
);

test(
  "Given participant and team profile cards, when rendering standings link, then visibility can be controlled via showStandingsLink prop",
  () => {
    const participantContent = readFile("src/components/Portal/ParticipantProfile/ParticipantProfile.js");
    const teamContent = readFile("src/components/Portal/TeamProfile/TeamProfile.js");

    assert.ok(
      participantContent.includes("showStandingsLink = isAdmin"),
      "ParticipantProfile must default standings visibility to admin-only"
    );
    assert.ok(
      teamContent.includes("showStandingsLink = isAdmin"),
      "TeamProfile must default standings visibility to admin-only"
    );
    assert.ok(
      participantContent.includes("{showStandingsLink && ("),
      "ParticipantProfile must render standings link from showStandingsLink"
    );
    assert.ok(
      teamContent.includes("{showStandingsLink && ("),
      "TeamProfile must render standings link from showStandingsLink"
    );
  }
);

test(
  "Given the scores page admin controls, when reading source, then it includes a toggle button that updates visibility via admin API",
  () => {
    const content = readFile("src/pages/portal/scores.js");
    assert.ok(
      content.includes("participantsCanViewScores ? \"On\" : \"Off\""),
      "Scores page must include a compact On/Off visibility toggle button"
    );
    assert.ok(
      content.includes("aria-label=\"Participants can view standings\""),
      "Scores page toggle button must include accessible context"
    );
    assert.ok(
      content.includes("/api/portal/admin/scores/visibility"),
      "Scores page toggle button must call admin visibility API endpoint"
    );
    assert.ok(
      content.includes("useVisibilityToggle"),
      "Scores page should use shared visibility toggle hook"
    );
  }
);

test(
  "Given scores visibility admin API route, when checking source, then admins can GET and PUT participants visibility setting",
  () => {
    const content = readFile("src/pages/api/portal/admin/scores/visibility.js");
    assert.ok(
      content.includes("createVisibilityToggleHandler"),
      "Visibility API should use shared route factory"
    );
    assert.ok(
      content.includes("valueKey: \"participantsCanViewScores\""),
      "Visibility API should configure participantsCanViewScores key"
    );
    assert.ok(
      content.includes("participantsCanViewScores"),
      "Visibility API must read and write participantsCanViewScores"
    );
  }
);
