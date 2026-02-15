const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const TEAM_API_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/teams/[teamSlug].js"
);

test(
  "Given team API route, when checking auth logic, then it allows any authenticated session and does not enforce same-team restriction",
  () => {
    const source = fs.readFileSync(TEAM_API_PATH, "utf8");
    assert.ok(
      source.includes("requireAnySession"),
      "team API must use requireAnySession for participant/admin read access"
    );
    assert.ok(
      !source.includes("authorizeParticipant"),
      "team API must not enforce team-only participant authorization"
    );
  }
);
