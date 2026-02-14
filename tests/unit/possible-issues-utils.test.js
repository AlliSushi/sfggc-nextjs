import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseParticipantList,
  shouldShowPossibleIssuesSection,
  buildPossibleIssuesFromRows,
  buildPossibleIssuesReport,
} from "../../src/utils/portal/possible-issues.js";

describe("possible issues visibility", () => {
  it("Given lane data exists and a majority has lanes, when checking visibility, then section is shown", () => {
    const show = shouldShowPossibleIssuesSection({
      totalParticipants: 132,
      participantsWithLane: 121,
    });
    assert.equal(show, true);
  });

  it("Given lane data exists but no majority has lanes, when checking visibility, then section is hidden", () => {
    const show = shouldShowPossibleIssuesSection({
      totalParticipants: 132,
      participantsWithLane: 50,
    });
    assert.equal(show, false);
  });

  it("Given no participants with assigned lanes, when checking visibility, then section is hidden", () => {
    const show = shouldShowPossibleIssuesSection({
      totalParticipants: 132,
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
});
