import { buildDisplayName } from "./name-helpers.js";
import { DIVISION_LABELS, DIVISION_ORDER } from "./division-constants.js";
import { sortByNumericFieldAndName, addRanks } from "./standings-helpers.js";
const SCRATCH_EVENT_SCORE_KEYS = {
  team: ["t1", "t2", "t3"],
  doubles: ["d1", "d2", "d3"],
  singles: ["s1", "s2", "s3"],
};

const createEmptyScratchMasters = () =>
  DIVISION_ORDER.reduce((acc, division) => {
    acc[division] = [];
    return acc;
  }, {});

const createScratchParticipant = (row) => ({
  pid: row.pid,
  division: row.division,
  name: buildDisplayName(row),
  scratch: 0,
  hasScores: false,
  t1: null,
  t2: null,
  t3: null,
  d1: null,
  d2: null,
  d3: null,
  s1: null,
  s2: null,
  s3: null,
});

const applyEventScores = (entry, row) => {
  const eventKeys = SCRATCH_EVENT_SCORE_KEYS[row.event_type];
  if (!eventKeys) return;
  entry[eventKeys[0]] = row.game1 ?? null;
  entry[eventKeys[1]] = row.game2 ?? null;
  entry[eventKeys[2]] = row.game3 ?? null;
};

const applyCumulativeTotals = (entry, row) => {
  const games = [row.game1, row.game2, row.game3];
  const nonNullGames = games.filter((score) => score != null);
  if (nonNullGames.length === 0) return;

  entry.hasScores = true;
  entry.scratch += nonNullGames.reduce((sum, score) => sum + score, 0);
};

const toStandingsEntry = (participant) => ({
  rank: 0,
  pid: participant.pid,
  division: participant.division,
  name: participant.name,
  t1: participant.t1,
  t2: participant.t2,
  t3: participant.t3,
  d1: participant.d1,
  d2: participant.d2,
  d3: participant.d3,
  s1: participant.s1,
  s2: participant.s2,
  s3: participant.s3,
  totalScratch: participant.hasScores ? participant.scratch : null,
  total: participant.hasScores ? participant.scratch : null,
});

const buildScratchMasters = (rows) => {
  const grouped = new Map();

  for (const row of rows) {
    if (!row?.division || !DIVISION_LABELS[row.division]) continue;
    const key = row.pid;
    if (!grouped.has(key)) {
      grouped.set(key, createScratchParticipant(row));
    }

    const entry = grouped.get(key);
    applyEventScores(entry, row);
    applyCumulativeTotals(entry, row);
  }

  const standings = createEmptyScratchMasters();
  for (const participant of grouped.values()) {
    standings[participant.division].push(toStandingsEntry(participant));
  }

  for (const division of DIVISION_ORDER) {
    standings[division].sort(sortByNumericFieldAndName("total"));
    addRanks(standings[division]);
  }

  return standings;
};

const hasAnyScratchMasters = (standings) =>
  Object.values(standings || {}).some((entries) => (entries?.length || 0) > 0);

export { createEmptyScratchMasters, buildScratchMasters, hasAnyScratchMasters };
