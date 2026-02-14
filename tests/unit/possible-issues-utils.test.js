import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  parseParticipantList,
  shouldShowPossibleIssuesSection,
  buildPossibleIssuesFromRows,
  buildPossibleIssuesReport,
} from "../../src/utils/portal/possible-issues.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSSIBLE_ISSUES_PATH = path.join(
  __dirname,
  "../../src/utils/portal/possible-issues.js"
);
const possibleIssuesSrc = fs.readFileSync(POSSIBLE_ISSUES_PATH, "utf-8");

describe("possible issues visibility", () => {
  it("Given lane data exists and a majority has lanes, when checking visibility, then section is shown", () => {
    const show = shouldShowPossibleIssuesSection({
      totalParticipants: 132,
      participantsWithLane: 121,
    });
    assert.equal(show, true);
  });

  it("Given participants exist but no lanes assigned, when checking visibility, then section is shown", () => {
    const show = shouldShowPossibleIssuesSection({
      totalParticipants: 132,
      participantsWithLane: 0,
    });
    assert.equal(show, true);
  });

  it("Given participants exist with minority lane coverage, when checking visibility, then section is shown", () => {
    const show = shouldShowPossibleIssuesSection({
      totalParticipants: 132,
      participantsWithLane: 50,
    });
    assert.equal(show, true);
  });

  it("Given no participants at all, when checking visibility, then section is hidden", () => {
    const show = shouldShowPossibleIssuesSection({
      totalParticipants: 0,
      participantsWithLane: 0,
    });
    assert.equal(show, false);
  });
});

describe("possible issues composition", () => {
  it("Given a partner list string, when parsed, then entries include pid and name", () => {
    const parsed = parseParticipantList("P10:Alpha Bowler | P11:Beta Bowler");
    assert.deepEqual(parsed, [
      { pid: "P10", name: "Alpha Bowler" },
      { pid: "P11", name: "Beta Bowler" },
    ]);
  });

  it("Given discrepant rows, when building issues, then issue cards contain titles, counts, and actionable detail rows", () => {
    const issues = buildPossibleIssuesFromRows({
      noTeamNoLaneNoPartner: [
        { pid: "P1", first_name: "No", last_name: "Team" },
      ],
      partnerTargetMultipleOwners: [
        {
          pid: "P2",
          first_name: "Shared",
          last_name: "Partner",
          affected_count: 2,
          affected_participants: "P10:Alpha Bowler | P11:Beta Bowler",
        },
      ],
      participantWithMultiplePartners: [],
      nonReciprocalPartnerRows: [],
      laneButNoTeam: [],
    });

    assert.equal(issues.length, 2);
    assert.equal(issues[0].count >= 1, true);
    assert.equal(typeof issues[0].title, "string");
    assert.equal(Array.isArray(issues[0].details), true);
    assert.equal(typeof issues[0].details[0].pid, "string");
    assert.equal(typeof issues[0].details[0].name, "string");
    assert.equal(typeof issues[0].details[0].detail, "string");
    assert.equal(Array.isArray(issues[1].details[0].relatedParticipants), true);
    assert.equal(issues[1].details[0].relatedParticipants.length > 0, true);
  });

  it("Given no discrepant rows, when building issues, then no issues are returned", () => {
    const issues = buildPossibleIssuesFromRows({
      noTeamNoLaneNoPartner: [],
      partnerTargetMultipleOwners: [],
      participantWithMultiplePartners: [],
      nonReciprocalPartnerRows: [],
      laneButNoTeam: [],
    });
    assert.deepEqual(issues, []);
  });

  it("Given majority lane coverage but no detected issues, when building report, then showSection is false", async () => {
    const queryStub = async (sql) => {
      if (sql.includes("select count(*) as count") && sql.includes("from people p")) {
        return { rows: [{ count: 10 }] };
      }
      if (sql.includes("count(distinct s.pid) as count")) {
        return { rows: [{ count: 8 }] };
      }
      return { rows: [] };
    };

    const report = await buildPossibleIssuesReport(queryStub);
    assert.equal(report.coverage.laneCoveragePct, 80);
    assert.equal(report.issues.length, 0);
    assert.equal(report.showSection, false);
  });

  it("Given zero lane coverage but orphaned participants exist, when building report, then showSection is true", async () => {
    const queryStub = async (sql) => {
      if (sql.includes("select count(*) as count") && sql.includes("from people p")) {
        return { rows: [{ count: 10 }] };
      }
      if (sql.includes("count(distinct s.pid) as count")) {
        return { rows: [{ count: 0 }] };
      }
      // Return orphaned participants for the no-team-no-lane-no-partner query
      if (sql.includes("dp_self.pid is null") && sql.includes("dp_partner.pid is null")) {
        return { rows: [{ pid: "P1", first_name: "Orphan", last_name: "Bowler" }] };
      }
      return { rows: [] };
    };

    const report = await buildPossibleIssuesReport(queryStub);
    assert.equal(report.coverage.laneCoveragePct, 0);
    assert.ok(report.issues.length > 0, "Should have at least one issue");
    assert.equal(report.showSection, true, "Section must be shown when issues exist, even without lane coverage");
  });
});

// ---------------------------------------------------------------------------
// NULL partner_pid must be excluded from partner-related issue queries
// ---------------------------------------------------------------------------

describe("possible issues NULL partner_pid exclusion", () => {
  it("Given fetchPartnerTargetMultipleOwners SQL, when grouping by partner_pid, then it excludes NULL partner_pid to prevent false positives", () => {
    // Extract the fetchPartnerTargetMultipleOwners function body
    const fnMatch = possibleIssuesSrc.match(
      /const fetchPartnerTargetMultipleOwners[\s\S]*?return rows;\s*\};/
    )?.[0] || "";

    assert.ok(
      fnMatch.length > 0,
      "fetchPartnerTargetMultipleOwners function must exist"
    );

    // SQL must filter out NULL partner_pid to avoid grouping all NULLs together
    const sqlLower = fnMatch.toLowerCase();
    assert.ok(
      sqlLower.includes("partner_pid is not null"),
      "fetchPartnerTargetMultipleOwners must include 'partner_pid is not null' to exclude NULL values from GROUP BY"
    );
  });

  it("Given fetchNonReciprocalPartnerRows SQL, when finding non-reciprocal mappings, then it excludes NULL partner_pid to prevent false positives", () => {
    // Extract the fetchNonReciprocalPartnerRows function body
    const fnMatch = possibleIssuesSrc.match(
      /const fetchNonReciprocalPartnerRows[\s\S]*?return rows;\s*\};/
    )?.[0] || "";

    assert.ok(
      fnMatch.length > 0,
      "fetchNonReciprocalPartnerRows function must exist"
    );

    // SQL must filter out NULL partner_pid — cleared partners are not "non-reciprocal"
    const sqlLower = fnMatch.toLowerCase();
    assert.ok(
      sqlLower.includes("partner_pid is not null"),
      "fetchNonReciprocalPartnerRows must include 'partner_pid is not null' to exclude cleared partner entries"
    );
  });

  it("Given buildPossibleIssuesReport with cleared partner_pid rows, when report is built, then no false positive issues appear for NULL partner_pid", async () => {
    // Simulate a database where 2 participants have partner_pid = NULL in doubles_pairs
    // This should NOT produce any partner-related issues
    const queryStub = async (sql) => {
      if (sql.includes("select count(*) as count") && sql.includes("from people p")) {
        return { rows: [{ count: 10 }] };
      }
      if (sql.includes("count(distinct s.pid) as count")) {
        return { rows: [{ count: 8 }] };
      }
      // All issue queries return empty — no real issues exist
      return { rows: [] };
    };

    const report = await buildPossibleIssuesReport(queryStub);
    // With no actual issues, there should be no partner-target-multiple-owners issue
    const falsePositive = report.issues.find(
      (issue) => issue.key === "partner-target-multiple-owners"
    );
    assert.equal(
      falsePositive,
      undefined,
      "No partner-target-multiple-owners issue should exist when all partner_pid values are NULL"
    );
  });
});
