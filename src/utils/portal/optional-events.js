import { buildDisplayName } from "./name-helpers.js";
import { DIVISION_ORDER } from "./division-constants.js";
import { toNumberOrNull } from "./number-utils.js";
import { sortByNumericFieldAndName, addRanks } from "./standings-helpers.js";

const createEmptyOptionalEventsStandings = () => ({
  bestOf3Of9: [],
  allEventsHandicapped: [],
  optionalScratch: DIVISION_ORDER.reduce((acc, division) => {
    acc[division] = [];
    return acc;
  }, {}),
});

const createOptionalParticipant = (row) => ({
  pid: row.pid,
  division: row.division || null,
  name: buildDisplayName(row),
  optionalBest3Of9: Number(row.optional_best_3_of_9 || 0) === 1,
  optionalScratch: Number(row.optional_scratch || 0) === 1,
  optionalAllEventsHdcp: Number(row.optional_all_events_hdcp || 0) === 1,
  scratchGames: [],
  hdcpGames: [],
});

const addRowScores = (participant, row) => {
  const handicap = toNumberOrNull(row.handicap) || 0;
  const games = [row.game1, row.game2, row.game3];
  for (const rawGame of games) {
    const scratch = toNumberOrNull(rawGame);
    if (scratch == null) continue;
    participant.scratchGames.push(scratch);
    participant.hdcpGames.push(scratch + handicap);
  }
};

const buildOptionalEventsStandings = (rows) => {
  const participants = new Map();

  for (const row of rows || []) {
    if (!row?.pid) continue;
    if (!participants.has(row.pid)) {
      participants.set(row.pid, createOptionalParticipant(row));
    }
    addRowScores(participants.get(row.pid), row);
  }

  const standings = createEmptyOptionalEventsStandings();

  for (const participant of participants.values()) {
    if (participant.hdcpGames.length === 0) continue;

    const top3HdcpGames = [...participant.hdcpGames].sort((a, b) => b - a).slice(0, 3);
    const bestOf3Total = top3HdcpGames.reduce((sum, score) => sum + score, 0);
    if (participant.optionalBest3Of9) {
      standings.bestOf3Of9.push({
        rank: 0,
        pid: participant.pid,
        name: participant.name,
        bestGame1: top3HdcpGames[0] ?? null,
        bestGame2: top3HdcpGames[1] ?? null,
        bestGame3: top3HdcpGames[2] ?? null,
        total: top3HdcpGames.length ? bestOf3Total : null,
      });
    }

    const totalScratch = participant.scratchGames.reduce((sum, score) => sum + score, 0);
    const total = participant.hdcpGames.reduce((sum, score) => sum + score, 0);
    if (participant.optionalAllEventsHdcp) {
      standings.allEventsHandicapped.push({
        rank: 0,
        pid: participant.pid,
        name: participant.name,
        totalScratch,
        totalHdcp: total - totalScratch,
        total,
      });
    }

    if (
      participant.optionalScratch &&
      participant.division &&
      standings.optionalScratch[participant.division]
    ) {
      standings.optionalScratch[participant.division].push({
        rank: 0,
        pid: participant.pid,
        name: participant.name,
        totalScratch,
      });
    }
  }

  standings.bestOf3Of9.sort(sortByNumericFieldAndName("total"));
  standings.allEventsHandicapped.sort(sortByNumericFieldAndName("total"));
  addRanks(standings.bestOf3Of9);
  addRanks(standings.allEventsHandicapped);

  for (const division of DIVISION_ORDER) {
    standings.optionalScratch[division].sort(sortByNumericFieldAndName("totalScratch"));
    addRanks(standings.optionalScratch[division]);
  }

  return standings;
};

const hasAnyOptionalEvents = (standings) =>
  (standings?.bestOf3Of9?.length || 0) > 0 ||
  (standings?.allEventsHandicapped?.length || 0) > 0 ||
  Object.values(standings?.optionalScratch || {}).some((entries) => (entries?.length || 0) > 0);

export {
  createEmptyOptionalEventsStandings,
  buildOptionalEventsStandings,
  hasAnyOptionalEvents,
};
