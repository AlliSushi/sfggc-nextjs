import { randomUUID } from "crypto";
import { EVENT_TYPES } from "./event-constants.js";
import { writeAuditEntries } from "./audit.js";
import { validateRequiredColumns, wouldClobberExisting } from "./import-csv-helpers.js";

const REQUIRED_COLUMNS = ["PID", "T_Lane", "D_Lane", "S_Lane"];

const normalizeLaneValue = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (trimmed === "" || trimmed === "#N/A") return null;
  return trimmed;
};

const validateColumns = (headers) => validateRequiredColumns(headers, REQUIRED_COLUMNS);

const buildUnmatchedRow = (row, pid, reason) => ({
  pid,
  email: row.Email || "",
  firstName: row.FirstName || "",
  lastName: row.LastName || "",
  teamName: row.Team_Name || "",
  reason,
});

const matchParticipants = async (rows, query) => {
  const matched = [];
  const unmatched = [];

  // Separate rows with valid PIDs from those without
  const rowsByPid = new Map();
  const duplicatePids = new Set();
  for (const row of rows) {
    const pid = (row.PID || "").trim();
    if (!pid) {
      unmatched.push(buildUnmatchedRow(row, "", "Missing PID"));
    } else {
      if (rowsByPid.has(pid)) {
        duplicatePids.add(pid);
      }
      rowsByPid.set(pid, row);
    }
  }

  for (const pid of duplicatePids) {
    unmatched.push(
      buildUnmatchedRow(rowsByPid.get(pid), pid, "Duplicate PID in CSV; earlier occurrence skipped")
    );
  }

  const rowsWithPid = [...rowsByPid.entries()].map(([pid, row]) => ({ row, pid }));
  if (rowsWithPid.length === 0) return { matched, unmatched };

  // Batch lookup all PIDs in one query
  const placeholders = rowsWithPid.map(() => "?").join(",");
  const pidParams = rowsWithPid.map((entry) => entry.pid);
  const { rows: dbRows } = await query(
    `SELECT pid, first_name, last_name, email, tnmt_id FROM people WHERE pid IN (${placeholders})`,
    pidParams
  );
  const existingPidSet = new Set(dbRows.map((r) => String(r.pid)));

  for (const { row, pid } of rowsWithPid) {
    if (existingPidSet.has(pid)) {
      matched.push({
        pid,
        firstName: row.FirstName || "",
        lastName: row.LastName || "",
        teamName: row.Team_Name || "",
        lanes: {
          team: normalizeLaneValue(row.T_Lane),
          doubles: normalizeLaneValue(row.D_Lane),
          singles: normalizeLaneValue(row.S_Lane),
        },
      });
    } else {
      unmatched.push(buildUnmatchedRow(row, pid, "PID not found"));
    }
  }

  return { matched, unmatched };
};

const LANE_AUDIT_FIELDS = {
  [EVENT_TYPES.TEAM]: "lane_team",
  [EVENT_TYPES.DOUBLES]: "lane_doubles",
  [EVENT_TYPES.SINGLES]: "lane_singles",
};

const getCurrentLanesMap = async (participants, query) => {
  const pids = [...new Set(participants.map((participant) => participant.pid))];
  if (pids.length === 0) {
    return new Map();
  }

  const placeholders = pids.map(() => "?").join(",");
  const { rows: scoreRows } = await query(
    `SELECT pid, event_type, lane FROM scores WHERE pid IN (${placeholders})`,
    pids
  );

  const lanesByPid = new Map();
  for (const row of scoreRows) {
    const pid = String(row.pid);
    const lanesByEvent = lanesByPid.get(pid) || {};
    lanesByEvent[row.event_type] = row.lane || null;
    lanesByPid.set(pid, lanesByEvent);
  }

  return lanesByPid;
};

const computeLaneChanges = (newLanes, currentLanes) => {
  const changes = [];
  for (const [eventType, auditField] of Object.entries(LANE_AUDIT_FIELDS)) {
    const newLane = newLanes[eventType] ?? null;
    const oldLane = currentLanes[eventType] ?? null;
    if (wouldClobberExisting(newLane, oldLane)) continue;
    if (newLane !== oldLane) {
      changes.push({ eventType, auditField, oldLane, newLane });
    }
  }
  return changes;
};

const importLanes = async (matched, adminEmail, query) => {
  let updated = 0;
  let skipped = 0;
  const currentLanesByPid = await getCurrentLanesMap(matched, query);

  for (const participant of matched) {
    const currentLanes = currentLanesByPid.get(participant.pid) || {};
    const changes = computeLaneChanges(participant.lanes, currentLanes);

    if (changes.length === 0) {
      skipped += 1;
      continue;
    }

    for (const { eventType, newLane } of changes) {
      await query(
        `INSERT INTO scores (id, pid, event_type, lane, updated_at)
         VALUES (?, ?, ?, ?, now())
         ON DUPLICATE KEY UPDATE
           lane = VALUES(lane),
           updated_at = now()`,
        [randomUUID(), participant.pid, eventType, newLane]
      );
    }

    await writeAuditEntries(
      adminEmail,
      participant.pid,
      changes.map(({ auditField, oldLane, newLane }) => ({
        field: auditField,
        oldValue: oldLane ?? "",
        newValue: newLane ?? "",
      })),
      query
    );

    updated += 1;
  }

  return { updated, skipped };
};

export { normalizeLaneValue, validateColumns, matchParticipants, importLanes, REQUIRED_COLUMNS };
