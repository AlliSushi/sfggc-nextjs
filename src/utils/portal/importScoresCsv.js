import { randomUUID } from "crypto";
import { writeAuditEntries } from "./audit.js";
import { validateRequiredColumns, wouldClobberExisting } from "./import-csv-helpers.js";

const REQUIRED_COLUMNS = [
  "Bowler name",
  "Scratch",
  "Game number",
  "Team name",
  "Lane number",
];

const normalizeScoreValue = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  if (Number.isNaN(num)) return null;
  return num;
};

const validateColumns = (headers) => validateRequiredColumns(headers, REQUIRED_COLUMNS);

const EVENT_PREFIX_MAP = { T: "team", D: "doubles", S: "singles" };

/**
 * Detect the event type from the CSV's "Game name" column.
 * Game names follow the pattern: "2/13/ 7:00 PM  T1-Teams 1"
 * where the prefix letter (T/D/S) indicates team/doubles/singles.
 *
 * @param {Object[]} rows - Parsed CSV rows
 * @returns {string|null} "team", "doubles", "singles", or null if undetectable
 */
const detectCsvEventType = (rows) => {
  if (!rows || rows.length === 0) return null;
  const gameName = (rows[0]["Game name"] || "").trim();
  if (!gameName) return null;
  const match = gameName.match(/([TDS])\d+-/);
  if (!match) return null;
  return EVENT_PREFIX_MAP[match[1]] || null;
};

/**
 * Pivot CSV rows (one per game per bowler) into per-bowler score objects.
 * Groups by lowercase bowler name; each bowler accumulates game1/game2/game3.
 *
 * @param {Object[]} rows - Parsed CSV rows
 * @returns {Map<string, { name, csvTeamName, csvLane, game1, game2, game3 }>}
 */
const pivotRowsByBowler = (rows) => {
  const bowlers = new Map();
  for (const row of rows) {
    const name = (row["Bowler name"] || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!bowlers.has(key)) {
      bowlers.set(key, {
        name,
        csvTeamName: (row["Team name"] || "").trim(),
        csvLane: (row["Lane number"] || "").trim(),
        game1: null,
        game2: null,
        game3: null,
      });
    }
    const gameNum = parseInt(row["Game number"], 10);
    const score = normalizeScoreValue(row["Scratch"]);
    const bowler = bowlers.get(key);
    if (gameNum === 1) bowler.game1 = score;
    else if (gameNum === 2) bowler.game2 = score;
    else if (gameNum === 3) bowler.game3 = score;
  }
  return bowlers;
};

/**
 * Check whether a CSV team name matches a DB team name,
 * accounting for truncation by the bowling scoring software.
 */
const teamNamesMatch = (csvTeamName, dbTeamName) => {
  if (!csvTeamName || !dbTeamName) return true; // can't compare, assume ok
  const csvLower = csvTeamName.toLowerCase();
  const dbLower = dbTeamName.toLowerCase();
  return dbLower.startsWith(csvLower) || csvLower.startsWith(dbLower);
};

const buildNameIndex = (dbPeople) => {
  const nameIndex = new Map();
  const addToIndex = (key, person) => {
    if (!key) return;
    const list = nameIndex.get(key) || [];
    if (!list.some((p) => p.pid === person.pid)) list.push(person);
    nameIndex.set(key, list);
  };

  for (const person of dbPeople) {
    const fullName = `${person.first_name} ${person.last_name}`.toLowerCase().trim();
    addToIndex(fullName, person);
    if (person.nickname) {
      const nickName = `${person.nickname} ${person.last_name}`.toLowerCase().trim();
      if (nickName !== fullName) addToIndex(nickName, person);
    }
  }

  return nameIndex;
};

const resolveMatchedPerson = (candidates, bowler) => {
  if (candidates.length === 0) {
    return { person: null, reason: "Name not found in database" };
  }
  if (candidates.length === 1) {
    return { person: candidates[0], reason: null };
  }

  const teamMatches = candidates.filter((candidate) =>
    teamNamesMatch(bowler.csvTeamName, candidate.team_name)
  );
  if (teamMatches.length === 1) {
    return { person: teamMatches[0], reason: null };
  }

  return { person: null, reason: "Multiple matches found; team name did not disambiguate" };
};

const buildCrossReferenceWarnings = ({ bowler, person, eventType }) => {
  const warnings = [];

  if (!teamNamesMatch(bowler.csvTeamName, person.team_name)) {
    warnings.push({
      pid: person.pid,
      name: bowler.name,
      type: "team_mismatch",
      expected: person.team_name || "",
      actual: bowler.csvTeamName,
    });
  }

  if (
    bowler.csvLane &&
    person.lane &&
    String(bowler.csvLane) !== String(person.lane)
  ) {
    warnings.push({
      pid: person.pid,
      name: bowler.name,
      type: "lane_mismatch",
      expected: String(person.lane),
      actual: bowler.csvLane,
    });
  }

  if (eventType === "doubles" && (!person.pair_size || person.pair_size < 2)) {
    warnings.push({
      pid: person.pid,
      name: bowler.name,
      type: "no_doubles_partner",
    });
  }

  return warnings;
};

/**
 * Match pivoted bowler records to people in the database by name.
 *
 * @param {Map} bowlerMap - Output of pivotRowsByBowler
 * @param {Function} query - Database query function
 * @param {string} eventType - Event type for fetching existing scores
 * @returns {{ matched, unmatched, warnings }}
 */
const matchParticipants = async (bowlerMap, query, eventType) => {
  const matched = [];
  const unmatched = [];
  const warnings = [];

  // Fetch all people with team names, existing scores, and doubles pair size
  const { rows: dbPeople } = await query(
    `SELECT p.pid, p.first_name, p.last_name, p.nickname, t.team_name,
            s.lane, s.game1, s.game2, s.game3, dp_size.pair_size
     FROM people p
     LEFT JOIN teams t ON p.tnmt_id = t.tnmt_id
     LEFT JOIN scores s ON s.pid = p.pid AND s.event_type = ?
     LEFT JOIN (
       SELECT did, COUNT(*) AS pair_size FROM doubles_pairs GROUP BY did
     ) dp_size ON dp_size.did = p.did`,
    [eventType]
  );

  const nameIndex = buildNameIndex(dbPeople);

  // Match each CSV bowler
  for (const [key, bowler] of bowlerMap) {
    const candidates = nameIndex.get(key) || [];
    const { person, reason } = resolveMatchedPerson(candidates, bowler);
    if (!person) {
      unmatched.push({
        name: bowler.name,
        csvTeamName: bowler.csvTeamName,
        reason,
      });
      continue;
    }

    warnings.push(...buildCrossReferenceWarnings({ bowler, person, eventType }));

    matched.push({
      pid: person.pid,
      firstName: person.first_name,
      lastName: person.last_name,
      dbTeamName: person.team_name || "",
      csvTeamName: bowler.csvTeamName,
      csvLane: bowler.csvLane,
      game1: bowler.game1,
      game2: bowler.game2,
      game3: bowler.game3,
      existingGame1: person.game1 ?? null,
      existingGame2: person.game2 ?? null,
      existingGame3: person.game3 ?? null,
    });
  }

  return { matched, unmatched, warnings };
};

const SCORE_AUDIT_FIELDS = {
  team: { game1: "score_team_game1", game2: "score_team_game2", game3: "score_team_game3" },
  doubles: { game1: "score_doubles_game1", game2: "score_doubles_game2", game3: "score_doubles_game3" },
  singles: { game1: "score_singles_game1", game2: "score_singles_game2", game3: "score_singles_game3" },
};

/**
 * Import matched scores into the scores table for a single event type.
 * Uses INSERT ON DUPLICATE KEY UPDATE with COALESCE for null-preservation.
 * Only touches game1, game2, game3 — never lane, entering_avg, or handicap.
 */
const importScores = async (matched, eventType, adminEmail, query) => {
  let updated = 0;
  let skipped = 0;
  const auditFields = SCORE_AUDIT_FIELDS[eventType];

  for (const bowler of matched) {
    // Determine which games actually changed
    const gameChanges = [];
    for (const gameKey of ["game1", "game2", "game3"]) {
      const newVal = bowler[gameKey];
      const existingVal = bowler[`existing${gameKey.charAt(0).toUpperCase()}${gameKey.slice(1)}`];

      // Skip if this would clobber existing data with null
      if (wouldClobberExisting(newVal, existingVal)) continue;

      if (newVal !== existingVal) {
        gameChanges.push({
          field: auditFields[gameKey],
          oldValue: existingVal,
          newValue: newVal,
          gameKey,
        });
      }
    }

    if (gameChanges.length === 0) {
      skipped += 1;
      continue;
    }

    await query(
      `INSERT INTO scores (id, pid, event_type, game1, game2, game3, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, now())
       ON DUPLICATE KEY UPDATE
         game1 = COALESCE(VALUES(game1), game1),
         game2 = COALESCE(VALUES(game2), game2),
         game3 = COALESCE(VALUES(game3), game3),
         updated_at = now()`,
      [randomUUID(), bowler.pid, eventType, bowler.game1, bowler.game2, bowler.game3]
    );

    await writeAuditEntries(
      adminEmail,
      bowler.pid,
      gameChanges.map(({ field, oldValue, newValue }) => ({
        field,
        oldValue: oldValue ?? "",
        newValue: newValue ?? "",
      })),
      query
    );

    updated += 1;
  }

  return { updated, skipped };
};

export {
  normalizeScoreValue,
  validateColumns,
  pivotRowsByBowler,
  matchParticipants,
  importScores,
  detectCsvEventType,
  REQUIRED_COLUMNS,
};
