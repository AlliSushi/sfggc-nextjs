import { buildDisplayName } from "./name-helpers.js";
import { sumFieldAcrossMembers } from "./score-helpers.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const sumMemberGames = (members) => ({
  game1: sumFieldAcrossMembers(members, "game1"),
  game2: sumFieldAcrossMembers(members, "game2"),
  game3: sumFieldAcrossMembers(members, "game3"),
});

const computeHdcp = (members) => {
  const total = members.reduce((sum, m) => sum + (m.handicap || 0), 0);
  return total * 3;
};

const computeTotals = (game1, game2, game3, hdcp) => {
  const allPresent = game1 != null && game2 != null && game3 != null;
  const totalScratch = allPresent ? game1 + game2 + game3 : null;
  const total = totalScratch != null ? totalScratch + hdcp : null;
  return { totalScratch, total };
};

const hasGameData = (entry) =>
  entry.game1 != null || entry.game2 != null || entry.game3 != null;

const assignRanks = (entries) => {
  entries.sort((a, b) => {
    if (a.total == null && b.total == null) return 0;
    if (a.total == null) return 1;
    if (b.total == null) return -1;
    return b.total - a.total;
  });
  entries.forEach((entry, i) => {
    entry.rank = i + 1;
  });
  return entries;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const buildTeamStandings = (rows) => {
  if (rows.length === 0) return [];

  const teams = new Map();
  for (const row of rows) {
    if (!teams.has(row.tnmt_id)) {
      teams.set(row.tnmt_id, {
        teamName: row.team_name,
        teamSlug: row.slug,
        members: [],
      });
    }
    teams.get(row.tnmt_id).members.push(row);
  }

  const entries = [];
  for (const team of teams.values()) {
    const games = sumMemberGames(team.members);
    const hdcp = computeHdcp(team.members);
    const { totalScratch, total } = computeTotals(games.game1, games.game2, games.game3, hdcp);
    entries.push({
      rank: 0,
      teamName: team.teamName,
      teamSlug: team.teamSlug,
      game1: games.game1,
      game2: games.game2,
      game3: games.game3,
      totalScratch,
      hdcp,
      total,
    });
  }

  return assignRanks(entries.filter(hasGameData));
};

const buildDoublesStandings = (rows) => {
  if (rows.length === 0) return [];

  const pairs = new Map();
  for (const row of rows) {
    if (!pairs.has(row.did)) {
      pairs.set(row.did, []);
    }
    pairs.get(row.did).push(row);
  }

  const entries = [];
  for (const rawMembers of pairs.values()) {
    const members = rawMembers.map((m) => {
      const hdcp = (m.handicap || 0) * 3;
      const { totalScratch, total } = computeTotals(m.game1, m.game2, m.game3, hdcp);
      return {
        pid: m.pid,
        name: buildDisplayName(m),
        game1: m.game1,
        game2: m.game2,
        game3: m.game3,
        totalScratch,
        hdcp,
        total,
      };
    });

    const anyGameData = members.some(
      (m) => m.game1 != null || m.game2 != null || m.game3 != null
    );
    if (!anyGameData) continue;

    const allComplete = members.every((m) => m.totalScratch != null);
    const doublesScratch = allComplete
      ? members.reduce((sum, m) => sum + m.totalScratch, 0)
      : null;
    const doublesTotal = allComplete
      ? members.reduce((sum, m) => sum + m.total, 0)
      : null;

    entries.push({
      rank: 0,
      pairName: members.map((m) => m.name).join(" & "),
      members,
      doublesScratch,
      doublesTotal,
      total: doublesTotal,
    });
  }

  return assignRanks(entries);
};

const buildSinglesStandings = (rows) => {
  if (rows.length === 0) return [];

  const entries = rows.map((row) => {
    const hdcp = (row.handicap || 0) * 3;
    const { totalScratch, total } = computeTotals(row.game1, row.game2, row.game3, hdcp);
    return {
      rank: 0,
      name: buildDisplayName(row),
      pid: row.pid,
      game1: row.game1,
      game2: row.game2,
      game3: row.game3,
      totalScratch,
      hdcp,
      total,
    };
  });

  return assignRanks(entries.filter(hasGameData));
};

const buildScoreStandings = ({ teamRows, doublesRows, singlesRows }) => ({
  team: buildTeamStandings(teamRows),
  doubles: buildDoublesStandings(doublesRows),
  singles: buildSinglesStandings(singlesRows),
});

const hasAnyScores = (standings) =>
  (standings?.team?.length || 0) > 0 ||
  (standings?.doubles?.length || 0) > 0 ||
  (standings?.singles?.length || 0) > 0;

export {
  buildTeamStandings,
  buildDoublesStandings,
  buildSinglesStandings,
  buildScoreStandings,
  hasAnyScores,
};
