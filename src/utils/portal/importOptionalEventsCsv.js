import {
  validateColumnsWithAliases,
  normalizeImportName,
  buildPersonNameIndex,
  dedupeRowsByKey,
} from "./import-csv-helpers.js";

const REQUIRED_COLUMNS = ["EID", "Last", "First", "Best 3 of 9", "Optional Scratch", "All Events Hdcp"];

const HEADER_ALIASES = {
  EID: ["EID", "\uFEFFEID"],
  Last: ["Last", "Last name", "Last Name"],
  First: ["First", "First name", "First Name"],
  "Best 3 of 9": ["Best 3 of 9"],
  "Optional Scratch": ["Optional Scratch"],
  "All Events Hdcp": ["All Events Hdcp", "All Events Handicapped"],
};

const validateColumns = (headers) =>
  validateColumnsWithAliases(headers, REQUIRED_COLUMNS, HEADER_ALIASES);

const normalizeOptionalName = normalizeImportName;

const parseOptionalFlag = (value) => (String(value || "").trim() === "1" ? 1 : 0);

const rowsConflict = (a, b) =>
  a.optionalBest3Of9 !== b.optionalBest3Of9 ||
  a.optionalScratch !== b.optionalScratch ||
  a.optionalAllEventsHdcp !== b.optionalAllEventsHdcp;

const normalizeCsvRows = (rows, headerMap) => {
  return dedupeRowsByKey({
    rows,
    toRecord: (rawRow) => {
      const eid = String(rawRow[headerMap.EID] || "").trim();
      const last = String(rawRow[headerMap.Last] || "").trim();
      const first = String(rawRow[headerMap.First] || "").trim();
      if (!eid || !last || !first) return null;

      const normalized = {
        eid,
        first,
        last,
        firstKey: normalizeOptionalName(first),
        lastKey: normalizeOptionalName(last),
        optionalBest3Of9: parseOptionalFlag(rawRow[headerMap["Best 3 of 9"]]),
        optionalScratch: parseOptionalFlag(rawRow[headerMap["Optional Scratch"]]),
        optionalAllEventsHdcp: parseOptionalFlag(rawRow[headerMap["All Events Hdcp"]]),
      };
      normalized.optionalEvents =
        normalized.optionalBest3Of9 || normalized.optionalScratch || normalized.optionalAllEventsHdcp
          ? 1
          : 0;
      return normalized;
    },
    getKey: (record) => record.eid,
    rowsConflict,
    missingRowWarning: () => "Skipped row missing EID/Last/First values.",
    duplicateConflictMessage: (record) =>
      `EID "${record.eid}" has conflicting duplicate rows; import blocked.`,
    duplicateWarningMessage: (record) =>
      `EID "${record.eid}" has duplicate identical rows; deduped.`,
  });
};

const matchOptionalEventsParticipants = async (csvRows, dbPeople, headerMapOverride = null) => {
  const headers = Object.keys(csvRows?.[0] || {});
  const validation = headerMapOverride
    ? { valid: true, missing: [], headerMap: headerMapOverride }
    : validateColumns(headers);

  if (!validation.valid) {
    return {
      matched: [],
      unmatched: [],
      updates: [],
      warnings: [],
      errors: [`Missing required columns: ${validation.missing.join(", ")}`],
    };
  }

  const normalized = normalizeCsvRows(csvRows, validation.headerMap);
  if (normalized.errors.length) {
    return {
      matched: [],
      unmatched: [],
      updates: [],
      warnings: normalized.warnings,
      errors: normalized.errors,
    };
  }

  const dbByPid = new Map(
    (dbPeople || []).map((person) => [String(person.pid || "").trim(), person])
  );
  const dbByName = buildPersonNameIndex(dbPeople || [], {
    normalizeName: normalizeOptionalName,
    buildCompositeKey: (first, last, normalize) => `${normalize(first)}|${normalize(last)}`,
  });

  const matched = [];
  const unmatched = [];
  const warnings = [...normalized.warnings];

  for (const row of normalized.rows) {
    let person = dbByPid.get(row.eid);
    if (!person) {
      const nameKey = `${row.firstKey}|${row.lastKey}`;
      const byName = dbByName.get(nameKey) || [];
      if (byName.length === 1) {
        person = byName[0];
        warnings.push(
          `Matched "${row.first} ${row.last}" by name because EID "${row.eid}" was not found.`
        );
      }
    }
    if (!person) {
      unmatched.push({ name: `${row.first} ${row.last}`, reason: "EID/name not found" });
      continue;
    }

    matched.push({
      pid: person.pid,
      name: `${row.first} ${row.last}`.trim(),
      optionalBest3Of9: row.optionalBest3Of9,
      optionalScratch: row.optionalScratch,
      optionalAllEventsHdcp: row.optionalAllEventsHdcp,
      optionalEvents: row.optionalEvents,
    });
  }

  const byPid = new Map(matched.map((entry) => [String(entry.pid), entry]));
  const updates = (dbPeople || []).map((person) => {
    const matchedRow = byPid.get(String(person.pid));
    return {
      pid: person.pid,
      optionalBest3Of9: matchedRow?.optionalBest3Of9 || 0,
      optionalScratch: matchedRow?.optionalScratch || 0,
      optionalAllEventsHdcp: matchedRow?.optionalAllEventsHdcp || 0,
      optionalEvents: matchedRow?.optionalEvents || 0,
    };
  });

  return { matched, unmatched, updates, warnings, errors: [] };
};

export { REQUIRED_COLUMNS, validateColumns, normalizeOptionalName, matchOptionalEventsParticipants };
