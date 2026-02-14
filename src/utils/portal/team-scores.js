import { filterNonNull } from "./array-helpers.js";
import { sumFieldAcrossMembers, sumNullableValues } from "./score-helpers.js";

/**
 * Sum all team members' game scores per game number.
 * Team Game 1 = sum of all members' team_game1, etc.
 *
 * @param {Array<{team_game1, team_game2, team_game3}>} members
 * @returns {number[]} Array of 0-3 game totals (nulls filtered out)
 */
const extractTeamScores = (members) => {
  const withScores = members.filter(
    (m) => m.team_game1 != null || m.team_game2 != null || m.team_game3 != null
  );
  if (withScores.length === 0) return [];

  return filterNonNull([
    sumFieldAcrossMembers(members, "team_game1"),
    sumFieldAcrossMembers(members, "team_game2"),
    sumFieldAcrossMembers(members, "team_game3"),
  ]);
};

/**
 * Extract the team lane from the first member that has one.
 *
 * @param {Array<{team_lane}>} members
 * @returns {string}
 */
const extractTeamLane = (members) => {
  const laneSource = members.find((m) => m.team_lane);
  return laneSource?.team_lane || "";
};

/**
 * Sum both doubles partners' game scores per game number.
 *
 * @param {{doubles_game1, doubles_game2, doubles_game3}} member1
 * @param {{doubles_game1, doubles_game2, doubles_game3}|null} member2
 * @returns {number[]} Array of 0-3 game totals (nulls filtered out)
 */
const extractDoublesPairScores = (member1, member2) => {
  const hasScores = (m) =>
    m && (m.doubles_game1 != null || m.doubles_game2 != null || m.doubles_game3 != null);

  if (!hasScores(member1) && !hasScores(member2)) return [];

  const sumGame = (field) => sumNullableValues([member1?.[field], member2?.[field]]);

  return filterNonNull([
    sumGame("doubles_game1"),
    sumGame("doubles_game2"),
    sumGame("doubles_game3"),
  ]);
};

export { extractTeamScores, extractTeamLane, extractDoublesPairScores };
