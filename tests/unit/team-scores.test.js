const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readFile = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

// ---------------------------------------------------------------------------
// ScoreCard shared component tests
// ---------------------------------------------------------------------------

test(
  "Given ScoreCard component, when checking source, then it renders Game 1, Game 2, Game 3, and Total boxes",
  () => {
    const content = readFile("src/components/Portal/ScoreCard/ScoreCard.js");
    assert.ok(content.includes("Game 1"), "ScoreCard must show Game 1 label");
    assert.ok(content.includes("Game 2"), "ScoreCard must show Game 2 label");
    assert.ok(content.includes("Game 3"), "ScoreCard must show Game 3 label");
    assert.ok(content.includes("Total"), "ScoreCard must show Total label");
  }
);

test(
  "Given ScoreCard component, when all three games have values, then Total is their sum",
  () => {
    const content = readFile("src/components/Portal/ScoreCard/ScoreCard.js");
    assert.ok(
      content.includes("game1 + game2 + game3"),
      "ScoreCard must compute total as the sum of the three games"
    );
  }
);

test(
  "Given ScoreCard component, when a game value is missing, then it displays an em-dash",
  () => {
    const content = readFile("src/components/Portal/ScoreCard/ScoreCard.js");
    // \u2014 is em-dash
    assert.ok(
      content.includes("\u2014") || content.includes("\\u2014"),
      "ScoreCard must display an em-dash for missing values"
    );
  }
);

test(
  "Given ScoreCard component, when any game is null, then Total also shows em-dash",
  () => {
    const content = readFile("src/components/Portal/ScoreCard/ScoreCard.js");
    // Total is only computed when all three are non-null
    assert.ok(
      content.includes("game1 != null && game2 != null && game3 != null"),
      "ScoreCard must only compute total when all three games are present"
    );
  }
);

// ---------------------------------------------------------------------------
// DRY: Both TeamProfile and ParticipantProfile use ScoreCard
// ---------------------------------------------------------------------------

test(
  "Given TeamProfile component, when rendering scores, then it uses the shared ScoreCard component",
  () => {
    const content = readFile("src/components/Portal/TeamProfile/TeamProfile.js");
    assert.ok(
      content.includes('from "../ScoreCard/ScoreCard"'),
      "TeamProfile must import ScoreCard"
    );
    assert.ok(
      content.includes("team.scores"),
      "TeamProfile must pass team.scores to ScoreCard"
    );
  }
);

test(
  "Given TeamProfile component, when rendering lane, then it shows lane value with em-dash fallback",
  () => {
    const content = readFile("src/components/Portal/TeamProfile/TeamProfile.js");
    assert.ok(
      content.includes("Lane: {team.lane || \"—\"}"),
      "TeamProfile must display team lane with em-dash fallback"
    );
  }
);

test(
  "Given ParticipantProfile component, when rendering scores, then it uses the shared ScoreCard component for all three event types",
  () => {
    const content = readFile("src/components/Portal/ParticipantProfile/ParticipantProfile.js");
    assert.ok(
      content.includes('from "../ScoreCard/ScoreCard"'),
      "ParticipantProfile must import ScoreCard"
    );
    assert.ok(
      content.includes("participant.scores?.team"),
      "ParticipantProfile must pass team scores to ScoreCard"
    );
    assert.ok(
      content.includes("participant.scores?.doubles"),
      "ParticipantProfile must pass doubles scores to ScoreCard"
    );
    assert.ok(
      content.includes("participant.scores?.singles"),
      "ParticipantProfile must pass singles scores to ScoreCard"
    );
  }
);

test(
  "Given both profile components, when checking for duplicate score formatting, then neither contains a local formatScores function",
  () => {
    const teamContent = readFile("src/components/Portal/TeamProfile/TeamProfile.js");
    const participantContent = readFile("src/components/Portal/ParticipantProfile/ParticipantProfile.js");
    assert.ok(
      !teamContent.includes("const formatScores"),
      "TeamProfile must not define its own formatScores — use ScoreCard instead"
    );
    assert.ok(
      !participantContent.includes("const formatScores"),
      "ParticipantProfile must not define its own formatScores — use ScoreCard instead"
    );
  }
);

// ---------------------------------------------------------------------------
// API source‑analysis tests (teams/[teamSlug].js)
// ---------------------------------------------------------------------------

test(
  "Given team API, when building the response, then it joins the scores table for team event scores",
  () => {
    const content = readFile("src/pages/api/portal/teams/[teamSlug].js");
    assert.ok(
      content.includes("left join scores s on s.pid = p.pid"),
      "Team API must join scores table to fetch team game scores"
    );
    // After refactoring to use EVENT_TYPES constant, the filter uses parameterized query
    const usesEventTypeFilter =
      content.includes("event_type = 'team'") ||
      (content.includes("event_type = ?") && content.includes("EVENT_TYPES.TEAM"));
    assert.ok(
      usesEventTypeFilter,
      "Team API must filter scores join to team event_type (either literal or via EVENT_TYPES constant)"
    );
  }
);

test(
  "Given team API, when building the response, then team scores are on the team object (not per-member)",
  () => {
    const content = readFile("src/pages/api/portal/teams/[teamSlug].js");
    assert.ok(
      content.includes("scores: teamScores"),
      "Team API must include scores on the team object as a single aggregate value"
    );
  }
);

test(
  "Given team API, when building the response, then team lane is included on the team object",
  () => {
    const content = readFile("src/pages/api/portal/teams/[teamSlug].js");
    assert.ok(
      content.includes("s.lane as team_lane"),
      "Team API must select lane from scores table for team event"
    );
    assert.ok(
      content.includes("lane: teamLane"),
      "Team API must include lane on the team response object"
    );
  }
);

test(
  "Given team-scores module, when no members have scores, then extractTeamScores returns an empty array",
  () => {
    const content = readFile("src/utils/portal/team-scores.js");
    assert.ok(
      content.includes("return []"),
      "extractTeamScores must return an empty array when no member has scores"
    );
    assert.ok(
      content.includes("filterNonNull("),
      "extractTeamScores must use filterNonNull for score aggregation"
    );
  }
);
