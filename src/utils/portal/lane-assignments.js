import { EVENT_TYPES } from "./event-constants.js";
import { buildDisplayName } from "./name-helpers.js";
import { toTeamSlug } from "./slug.js";

const EM_DASH = "\u2014";

const parseLaneNumber = (lane) => {
  const normalized = String(lane || "").trim();
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toDisplayEntries = (entries) => {
  if (!entries || entries.size === 0) return [{ label: EM_DASH }];
  return [...entries.values()].sort((a, b) => a.label.localeCompare(b.label));
};

const toDisplayValue = (members) => members.join(", ");

const toOddLane = (laneNumber) => (laneNumber % 2 === 0 ? laneNumber - 1 : laneNumber);

const buildOddLaneRows = (laneEntries) => {
  const oddLanes = [...new Set([...laneEntries.keys()].map((lane) => toOddLane(lane)))].sort(
    (a, b) => a - b
  );
  return oddLanes.map((lane) => {
    const leftEntries = toDisplayEntries(laneEntries.get(lane));
    const rightEntries = toDisplayEntries(laneEntries.get(lane + 1));
    const leftMembers = leftEntries.map((entry) => entry.label);
    const rightMembers = rightEntries.map((entry) => entry.label);
    return {
      lane,
      leftEntries,
      rightEntries,
      leftMembers,
      rightMembers,
      left: toDisplayValue(leftMembers),
      right: toDisplayValue(rightMembers),
    };
  });
};

const ensureLaneEntryMap = (map, lane) => {
  const existing = map.get(lane);
  if (existing) return existing;
  const created = new Map();
  map.set(lane, created);
  return created;
};

const addLaneEntry = (laneEntries, lane, entry, key) => {
  const laneNumber = parseLaneNumber(lane);
  if (!laneNumber || !entry || !entry.label) return;
  const entries = ensureLaneEntryMap(laneEntries, laneNumber);
  entries.set(key, entry);
};

const formatPerson = (row, prefix = "") => {
  const person = {
    first_name: row?.[`${prefix}first_name`] || "",
    last_name: row?.[`${prefix}last_name`] || "",
    nickname: row?.[`${prefix}nickname`] || "",
  };
  return buildDisplayName(person);
};

const formatTeamEntry = (row) => {
  const teamName = String(row?.team_name || "").trim();
  if (!teamName) return null;
  const teamSlug = row?.team_slug || toTeamSlug(teamName);
  return { label: teamName, teamSlug };
};

const formatPersonEntry = (row) => {
  const label = formatPerson(row);
  if (!label) return null;
  const pid = row?.pid ? String(row.pid).trim() : "";
  return pid ? { label, pid } : { label };
};

const buildTeamAssignments = (rows = []) => {
  const laneEntries = new Map();
  rows.forEach((row) => {
    const entry = formatTeamEntry(row);
    if (!entry) return;
    addLaneEntry(laneEntries, row.lane, entry, entry.teamSlug || entry.label);
  });
  return buildOddLaneRows(laneEntries);
};

const buildPersonAssignments = (rows = []) => {
  const laneEntries = new Map();
  rows.forEach((row) => {
    const entry = formatPersonEntry(row);
    if (!entry) return;
    addLaneEntry(laneEntries, row.lane, entry, entry.pid || entry.label);
  });
  return buildOddLaneRows(laneEntries);
};

const buildDoublesAssignments = buildPersonAssignments;
const buildSinglesAssignments = buildPersonAssignments;
// Kept as explicit aliases for event readability and potential future divergence.

const buildLaneAssignments = ({ teamRows = [], doublesRows = [], singlesRows = [] } = {}) => {
  return {
    [EVENT_TYPES.TEAM]: buildTeamAssignments(teamRows),
    [EVENT_TYPES.DOUBLES]: buildDoublesAssignments(doublesRows),
    [EVENT_TYPES.SINGLES]: buildSinglesAssignments(singlesRows),
  };
};

export { EM_DASH, buildLaneAssignments, parseLaneNumber };
