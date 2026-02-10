import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

/**
 * BDD tests for participant list query optimization.
 *
 * The participant list API must avoid correlated subqueries for scores.
 * Correlated subqueries execute once per row, producing 6 × N queries
 * (3 event types × 2 fields × N participants). With 200 participants,
 * that's 1,200 subquery executions per request.
 *
 * The fix uses LEFT JOINs on the scores table for each event type,
 * then COALESCE to pick the priority value (team > doubles > singles).
 * This reduces the query to a single execution with 3 additional joins.
 */

const PARTICIPANTS_API_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/participants/index.js"
);

test(
  "Given the participants API, when building the query, then it does NOT use correlated subqueries for scores",
  () => {
    const content = fs.readFileSync(PARTICIPANTS_API_PATH, "utf-8");

    // Correlated subqueries look like: (select ... from scores where pid = p.pid ...)
    const correlatedSubqueries = content.match(
      /\(select\s+\w+\s+from\s+scores\s+where\s+pid\s*=\s*p\.pid/gi
    );

    assert.ok(
      !correlatedSubqueries,
      `Participant query must NOT use correlated subqueries for scores ` +
      `(found ${correlatedSubqueries?.length || 0}). Use LEFT JOINs instead.`
    );
  }
);

test(
  "Given the participants API, when fetching scores, then it uses LEFT JOIN on scores table",
  () => {
    const content = fs.readFileSync(PARTICIPANTS_API_PATH, "utf-8");

    // Should use LEFT JOIN for scores
    const hasScoresJoin = content.match(/left\s+join\s+scores/i);

    assert.ok(
      hasScoresJoin,
      "Participant query must use LEFT JOIN on scores table instead of correlated subqueries"
    );
  }
);

test(
  "Given the participants API, when fetching book_average and handicap, then it uses COALESCE with joined columns",
  () => {
    const content = fs.readFileSync(PARTICIPANTS_API_PATH, "utf-8");

    // COALESCE should reference joined table aliases, not subqueries
    const hasCoalesce = content.match(/coalesce\s*\(/i);
    assert.ok(hasCoalesce, "Query must use COALESCE for book_average/handicap priority");

    // The COALESCE arguments should be table-aliased columns (e.g., st.entering_avg)
    // not subqueries (select entering_avg from scores where ...)
    const coalescePattern = content.match(
      /coalesce\s*\(\s*\w+\.\w+\s*,\s*\w+\.\w+/i
    );
    assert.ok(
      coalescePattern,
      "COALESCE must reference joined table aliases (e.g., st.entering_avg, sd.entering_avg) not subqueries"
    );
  }
);

test(
  "Given the participants API, when joining scores, then it joins for each event type with aliases",
  () => {
    const content = fs.readFileSync(PARTICIPANTS_API_PATH, "utf-8");

    // Should have multiple LEFT JOINs on scores with different event_type conditions
    const scoresJoins = content.match(/left\s+join\s+scores\b/gi);

    assert.ok(
      scoresJoins && scoresJoins.length >= 3,
      `Query must LEFT JOIN scores at least 3 times (one per event type: team, doubles, singles). ` +
      `Found ${scoresJoins?.length || 0} joins.`
    );
  }
);
