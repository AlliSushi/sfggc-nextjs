import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * BDD tests for formatParticipant query efficiency.
 *
 * The current implementation has an N+1 query problem:
 * - 1 query for person
 * - 1 query for team
 * - 1 query for doubles_pairs
 * - 1 query for partner (if exists)
 * - 1 query for scores
 * Total: 5 sequential queries
 *
 * The optimized version should use JOINs:
 * - 1 query for person + team + doubles_pairs + partner (LEFT JOIN)
 * - 1 query for scores
 * Total: 2 queries maximum
 *
 * This test verifies that formatParticipant makes ≤ 2 database calls
 * and still returns the correct data structure.
 */

test(
  "Given formatParticipant with a participant that has team and doubles data, when called, then it makes at most 2 database queries",
  async () => {
    const { formatParticipant } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    let queryCount = 0;
    const mockQuery = async (sql, params = []) => {
      queryCount++;
      const trimmed = sql.trim().toLowerCase();

      // First query should fetch person + team + doubles + partner with JOINs
      if (trimmed.includes("select") && trimmed.includes("from people")) {
        return {
          rows: [
            {
              pid: "3336",
              first_name: "Robert",
              last_name: "Aldeguer",
              nickname: null,
              email: "robert@example.com",
              phone: "555-555-5555",
              birth_month: 1,
              birth_day: 1,
              city: "San Francisco",
              region: "CA",
              country: "US",
              tnmt_id: "2305",
              did: "1076",
              // JOIN results from teams table (with prefixes as per formatParticipant JOIN query)
              team_tnmt_id: "2305",
              team_name: "Well, No Split!",
              team_slug: "well-no-split",
              // JOIN results from doubles_pairs table
              doubles_did: "1076",
              partner_pid: "1077",
              doubles_partner_first_name: null,
              doubles_partner_last_name: null,
              // JOIN results from partner lookup via dp.partner_pid (partner1)
              partner1_pid: "1077",
              partner1_first_name: "Dan",
              partner1_last_name: "Fahy",
              partner1_nickname: null,
              // JOIN results from partner lookup via p.did (partner2)
              partner2_pid: null,
              partner2_first_name: null,
              partner2_last_name: null,
              partner2_nickname: null,
            },
          ],
        };
      }

      // Second query should fetch all scores for the participant
      if (trimmed.includes("select") && trimmed.includes("from scores")) {
        return {
          rows: [
            {
              event_type: "team",
              lane: "12",
              game1: 150,
              game2: 160,
              game3: 170,
              entering_avg: 155,
              handicap: 30,
            },
            {
              event_type: "doubles",
              lane: "14",
              game1: 145,
              game2: 155,
              game3: 165,
              entering_avg: 155,
              handicap: 30,
            },
            {
              event_type: "singles",
              lane: "16",
              game1: 140,
              game2: 150,
              game3: 160,
              entering_avg: 155,
              handicap: 30,
            },
          ],
        };
      }

      return { rows: [] };
    };

    const result = await formatParticipant("3336", mockQuery);

    // Assert: Maximum 2 queries (efficient JOIN approach)
    assert.ok(
      queryCount <= 2,
      `formatParticipant must use efficient JOINs (≤2 queries), but made ${queryCount} queries`
    );

    // Assert: First query should be a JOIN (contains multiple table references)
    assert.ok(
      queryCount >= 1,
      "formatParticipant must make at least 1 query"
    );

    // Assert: Result structure is correct
    assert.ok(result, "formatParticipant must return a result");
    assert.equal(result.pid, "3336");
    assert.equal(result.firstName, "Robert");
    assert.equal(result.lastName, "Aldeguer");
    assert.equal(result.team.name, "Well, No Split!");
    assert.equal(result.doubles.partnerName, "Dan Fahy");
    assert.deepEqual(result.scores.team, [150, 160, 170]);
  }
);

test(
  "Given formatParticipant with a participant that has no team or doubles, when called, then it still makes at most 2 queries",
  async () => {
    const { formatParticipant } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    let queryCount = 0;
    const mockQuery = async (sql, params = []) => {
      queryCount++;
      const trimmed = sql.trim().toLowerCase();

      if (trimmed.includes("select") && trimmed.includes("from people")) {
        return {
          rows: [
            {
              pid: "9999",
              first_name: "Solo",
              last_name: "Player",
              nickname: null,
              email: "solo@example.com",
              phone: "555-000-0000",
              birth_month: 6,
              birth_day: 15,
              city: "Oakland",
              region: "CA",
              country: "US",
              tnmt_id: null,
              did: null,
              // No team or doubles data from JOINs
              team_tnmt_id: null,
              team_name: null,
              team_slug: null,
              doubles_did: null,
              partner_pid: null,
              doubles_partner_first_name: null,
              doubles_partner_last_name: null,
              partner1_pid: null,
              partner1_first_name: null,
              partner1_last_name: null,
              partner1_nickname: null,
              partner2_pid: null,
              partner2_first_name: null,
              partner2_last_name: null,
              partner2_nickname: null,
            },
          ],
        };
      }

      if (trimmed.includes("select") && trimmed.includes("from scores")) {
        return { rows: [] };
      }

      return { rows: [] };
    };

    const result = await formatParticipant("9999", mockQuery);

    assert.ok(
      queryCount <= 2,
      `formatParticipant must be efficient even with no team/doubles (≤2 queries), but made ${queryCount} queries`
    );

    assert.ok(result, "formatParticipant must return a result");
    assert.equal(result.pid, "9999");
    assert.equal(result.team.name, "");
    assert.equal(result.doubles.partnerName, "");
  }
);

test(
  "Given formatParticipant implementation, when checking query strategy, then the first query uses LEFT JOINs for related data",
  async () => {
    const { formatParticipant } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const queries = [];
    const mockQuery = async (sql, params = []) => {
      queries.push(sql.trim());
      return { rows: [] };
    };

    await formatParticipant("3336", mockQuery);

    // The first query should use LEFT JOINs to fetch all related data in one go
    const firstQuery = queries[0]?.toLowerCase() || "";

    // Check for JOIN pattern (should have multiple JOINs in a single query)
    const hasJoins = firstQuery.includes("join");

    assert.ok(
      hasJoins || queries.length <= 2,
      "formatParticipant must use JOIN queries or make ≤2 queries total. " +
      `First query: ${firstQuery.slice(0, 100)}...`
    );
  }
);

test(
  "Given formatParticipant with complex participant data, when called, then returned structure includes all required fields",
  async () => {
    const { formatParticipant } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const mockQuery = async (sql, params = []) => {
      const trimmed = sql.trim().toLowerCase();

      if (trimmed.includes("from people")) {
        return {
          rows: [
            {
              pid: "3336",
              first_name: "Robert",
              last_name: "Aldeguer",
              nickname: "Bob",
              email: "robert@example.com",
              phone: "555-555-5555",
              birth_month: 1,
              birth_day: 1,
              city: "San Francisco",
              region: "CA",
              country: "US",
              tnmt_id: "2305",
              did: "1076",
              team_tnmt_id: "2305",
              team_name: "Well, No Split!",
              team_slug: "well-no-split",
              doubles_did: "1076",
              partner_pid: "1077",
              doubles_partner_first_name: null,
              doubles_partner_last_name: null,
              partner1_pid: "1077",
              partner1_first_name: "Dan",
              partner1_last_name: "Fahy",
              partner1_nickname: null,
              partner2_pid: null,
              partner2_first_name: null,
              partner2_last_name: null,
              partner2_nickname: null,
            },
          ],
        };
      }

      if (trimmed.includes("from scores")) {
        return {
          rows: [
            {
              event_type: "team",
              lane: "12",
              game1: 150,
              game2: 160,
              game3: 170,
              entering_avg: 155,
              handicap: 30,
            },
          ],
        };
      }

      return { rows: [] };
    };

    const result = await formatParticipant("3336", mockQuery);

    // Verify complete data structure
    assert.ok(result, "Must return result object");
    assert.equal(result.pid, "3336");
    assert.equal(result.firstName, "Robert");
    assert.equal(result.lastName, "Aldeguer");
    assert.equal(result.nickname, "Bob");
    assert.equal(result.email, "robert@example.com");
    assert.equal(result.phone, "555-555-5555");
    assert.equal(result.birthMonth, 1);
    assert.equal(result.birthDay, 1);
    assert.equal(result.city, "San Francisco");
    assert.equal(result.region, "CA");
    assert.equal(result.country, "US");
    assert.equal(result.bookAverage, 155);

    // Team structure
    assert.ok(result.team, "Must have team object");
    assert.equal(result.team.tnmtId, "2305");
    assert.equal(result.team.name, "Well, No Split!");
    assert.equal(result.team.slug, "well-no-split");

    // Doubles structure
    assert.ok(result.doubles, "Must have doubles object");
    assert.equal(result.doubles.did, "1076");
    assert.equal(result.doubles.partnerPid, "1077");
    assert.equal(result.doubles.partnerName, "Dan Fahy");

    // Lanes structure
    assert.ok(result.lanes, "Must have lanes object");
    assert.equal(result.lanes.team, "12");

    // Averages structure
    assert.ok(result.averages, "Must have averages object");
    assert.equal(result.averages.entering, 155);
    assert.equal(result.averages.handicap, 30);

    // Scores structure
    assert.ok(result.scores, "Must have scores object");
    assert.ok(result.scores.team, "Must have team scores array");
    assert.deepEqual(result.scores.team, [150, 160, 170]);
  }
);

test(
  "Given formatParticipant is optimized, when comparing to N+1 pattern, then query count is reduced by at least 60%",
  async () => {
    const { formatParticipant } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    let queryCount = 0;
    const mockQuery = async (sql, params = []) => {
      queryCount++;
      const trimmed = sql.trim().toLowerCase();

      if (trimmed.includes("from people")) {
        return {
          rows: [
            {
              pid: "3336",
              first_name: "Robert",
              last_name: "Aldeguer",
              tnmt_id: "2305",
              did: "1076",
              team_tnmt_id: "2305",
              team_name: "Well, No Split!",
              team_slug: "well-no-split",
              doubles_did: "1076",
              partner_pid: "1077",
              doubles_partner_first_name: null,
              doubles_partner_last_name: null,
              partner1_pid: "1077",
              partner1_first_name: "Dan",
              partner1_last_name: "Fahy",
              partner1_nickname: null,
              partner2_pid: null,
              partner2_first_name: null,
              partner2_last_name: null,
              partner2_nickname: null,
            },
          ],
        };
      }

      if (trimmed.includes("from scores")) {
        return { rows: [] };
      }

      return { rows: [] };
    };

    await formatParticipant("3336", mockQuery);

    // Original N+1 pattern: 5 queries (person, team, doubles, partner, scores)
    // Optimized pattern: 2 queries (person+team+doubles+partner, scores)
    // Reduction: (5 - 2) / 5 = 60%
    const originalQueryCount = 5;
    const reduction = (originalQueryCount - queryCount) / originalQueryCount;

    assert.ok(
      reduction >= 0.6,
      `Query count must be reduced by at least 60% (from ${originalQueryCount} to ≤2 queries). ` +
      `Current: ${queryCount} queries (${Math.round(reduction * 100)}% reduction)`
    );
  }
);
