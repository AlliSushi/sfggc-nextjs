import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

/**
 * BDD tests for team lookup query optimization.
 *
 * The team API endpoint must look up teams by slug using a SQL WHERE clause
 * rather than fetching all teams and filtering in JavaScript. A full table
 * scan on every team page load adds unnecessary latency and database load.
 */

const TEAM_API_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/teams/[teamSlug].js"
);

test(
  "Given the team API module, when looking up a team by slug, then the query uses WHERE slug = ? instead of fetching all teams",
  () => {
    const content = fs.readFileSync(TEAM_API_PATH, "utf-8");

    // Must NOT fetch all teams without a WHERE clause
    const fetchesAllTeams = content.match(
      /query\s*\(\s*["'`]select \* from teams["'`]\s*\)/
    );
    assert.ok(
      !fetchesAllTeams,
      "Team lookup must NOT use 'select * from teams' without a WHERE clause (full table scan)"
    );
  }
);

test(
  "Given the team API module, when looking up a team by slug, then the query uses a parameterized WHERE clause",
  () => {
    const content = fs.readFileSync(TEAM_API_PATH, "utf-8");

    // Must use a WHERE clause with slug parameter
    const usesWhereClause = content.match(
      /query\s*\([^)]*where\s+slug\s*=\s*\?/i
    );
    assert.ok(
      usesWhereClause,
      "Team lookup must use a parameterized WHERE clause on slug column"
    );
  }
);

test(
  "Given the team API module, when looking up a team by slug, then the slug value is passed as a query parameter",
  () => {
    const content = fs.readFileSync(TEAM_API_PATH, "utf-8");

    // The fetchTeamBySlug function must pass teamSlug as a parameter
    const passesParameter = content.match(
      /fetchTeamBySlug[\s\S]*?query\s*\([^,]+,\s*\[teamSlug\]/
    );
    assert.ok(
      passesParameter,
      "Team lookup must pass teamSlug as a parameterized query value"
    );
  }
);
