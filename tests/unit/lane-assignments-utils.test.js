import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLaneAssignments } from "../../src/utils/portal/lane-assignments.js";

describe("buildLaneAssignments", () => {
  it("Given mixed team lane rows, when building assignments, then rows are paired by odd lane with team names", () => {
    const result = buildLaneAssignments({
      teamRows: [
        { lane: "2", team_name: "Pin Pals" },
        { lane: "1", team_name: "Split Happens" },
        { lane: "1", team_name: "Split Happens" },
        { lane: "4", team_name: "Lucky Strikes" },
        { lane: "3", team_name: "Gutter Gang" },
      ],
      doublesRows: [],
      singlesRows: [],
    });

    assert.deepEqual(result.team, [
      {
        lane: 1,
        leftEntries: [{ label: "Split Happens", teamSlug: "split-happens" }],
        rightEntries: [{ label: "Pin Pals", teamSlug: "pin-pals" }],
        leftMembers: ["Split Happens"],
        rightMembers: ["Pin Pals"],
        left: "Split Happens",
        right: "Pin Pals",
      },
      {
        lane: 3,
        leftEntries: [{ label: "Gutter Gang", teamSlug: "gutter-gang" }],
        rightEntries: [{ label: "Lucky Strikes", teamSlug: "lucky-strikes" }],
        leftMembers: ["Gutter Gang"],
        rightMembers: ["Lucky Strikes"],
        left: "Gutter Gang",
        right: "Lucky Strikes",
      },
    ]);
  });

  it("Given doubles rows across paired lanes, when building assignments, then each lane side lists bowlers line by line", () => {
    const result = buildLaneAssignments({
      teamRows: [],
      doublesRows: [
        {
          lane: "9",
          pid: "P1",
          did: "D1",
          first_name: "Alex",
          last_name: "A",
          partner_pid: "P2",
          partner_first_name: "Blair",
          partner_last_name: "B",
        },
        {
          lane: "9",
          pid: "P2",
          did: "D1",
          first_name: "Blair",
          last_name: "B",
          partner_pid: "P1",
          partner_first_name: "Alex",
          partner_last_name: "A",
        },
        {
          lane: "10",
          pid: "P3",
          did: "D2",
          first_name: "Casey",
          last_name: "C",
          partner_pid: "P4",
          partner_first_name: "Dee",
          partner_last_name: "D",
        },
        {
          lane: "10",
          pid: "P4",
          did: "D2",
          first_name: "Dee",
          last_name: "D",
          partner_pid: "P3",
          partner_first_name: "Casey",
          partner_last_name: "C",
        },
      ],
      singlesRows: [],
    });

    assert.deepEqual(result.doubles, [
      {
        lane: 9,
        leftEntries: [
          { label: "Alex A", pid: "P1" },
          { label: "Blair B", pid: "P2" },
        ],
        rightEntries: [
          { label: "Casey C", pid: "P3" },
          { label: "Dee D", pid: "P4" },
        ],
        leftMembers: ["Alex A", "Blair B"],
        rightMembers: ["Casey C", "Dee D"],
        left: "Alex A, Blair B",
        right: "Casey C, Dee D",
      },
    ]);
  });

  it("Given singles rows with missing paired lane, when building assignments, then unmatched side is an em dash", () => {
    const result = buildLaneAssignments({
      teamRows: [],
      doublesRows: [],
      singlesRows: [
        { lane: "5", first_name: "Evan", last_name: "E" },
        { lane: "7", first_name: "Fran", last_name: "F" },
      ],
    });

    assert.deepEqual(result.singles, [
      {
        lane: 5,
        leftEntries: [{ label: "Evan E" }],
        rightEntries: [{ label: "—" }],
        leftMembers: ["Evan E"],
        rightMembers: ["—"],
        left: "Evan E",
        right: "—",
      },
      {
        lane: 7,
        leftEntries: [{ label: "Fran F" }],
        rightEntries: [{ label: "—" }],
        leftMembers: ["Fran F"],
        rightMembers: ["—"],
        left: "Fran F",
        right: "—",
      },
    ]);
  });

  it("Given non-numeric or blank lanes, when building assignments, then invalid lanes are ignored", () => {
    const result = buildLaneAssignments({
      teamRows: [
        { lane: "", team_name: "No Lane" },
        { lane: "A", team_name: "Text Lane" },
        { lane: "12", team_name: "Valid Team" },
      ],
      doublesRows: [],
      singlesRows: [],
    });

    assert.deepEqual(result.team, [
      {
        lane: 11,
        leftEntries: [{ label: "—" }],
        rightEntries: [{ label: "Valid Team", teamSlug: "valid-team" }],
        leftMembers: ["—"],
        rightMembers: ["Valid Team"],
        left: "—",
        right: "Valid Team",
      },
    ]);
  });
});
