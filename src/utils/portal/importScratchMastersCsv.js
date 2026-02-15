import {
  validateColumnsWithAliases,
  normalizeImportName,
  buildPersonNameIndex,
  dedupeRowsByKey,
} from "./import-csv-helpers.js";

const REQUIRED_COLUMNS = ["Bowler Name", "SM?"];
const HEADER_ALIASES = {
  "Bowler Name": ["Bowler Name", "Bowler name"],
  "SM?": ["SM?", "SM", "Scratch Masters", "ScratchMasters"],
};

const normalizeScratchMastersName = normalizeImportName;

const validateColumns = (headers) =>
  validateColumnsWithAliases(headers, REQUIRED_COLUMNS, HEADER_ALIASES);

const parseScratchMastersFlag = (value) => {
  const normalized = String(value ?? "").trim();
  if (normalized === "1") return 1;
  if (normalized === "0") return 0;
  return null;
};

const rowsConflict = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (String(a[key] ?? "").trim() !== String(b[key] ?? "").trim()) {
      return true;
    }
  }
  return false;
};

const pickBestMatch = (candidates = []) => {
  if (candidates.length === 0) return null;

  const nicknameMatches = candidates.filter((entry) => entry.source === "nickname");
  if (nicknameMatches.length === 1) return nicknameMatches[0].person;
  if (nicknameMatches.length > 1) return null;

  const firstMatches = candidates.filter((entry) => entry.source === "first");
  if (firstMatches.length === 1) return firstMatches[0].person;
  return null;
};

const normalizeCsvRows = (rows, headerMap) => {
  const invalidRows = [];
  const deduped = dedupeRowsByKey({
    rows,
    toRecord: (rawRow) => {
      const bowlerName = String(rawRow[headerMap["Bowler Name"]] || "").trim();
      const nameKey = normalizeScratchMastersName(bowlerName);
      if (!nameKey) return null;

      const scratchMasters = parseScratchMastersFlag(rawRow[headerMap["SM?"]]);
      if (scratchMasters === null) {
        invalidRows.push(`Row for \"${bowlerName}\" has invalid SM? value; expected 0 or 1.`);
        return null;
      }

      return {
        bowlerName,
        nameKey,
        scratchMasters,
        raw: rawRow,
      };
    },
    getKey: (record) => record.nameKey,
    rowsConflict: (a, b) => rowsConflict(a.raw, b.raw),
    missingRowWarning: (rawRow) => {
      const bowlerName = String(rawRow?.[headerMap["Bowler Name"]] || "").trim();
      return bowlerName ? null : "Skipped row with empty Bowler Name.";
    },
    duplicateConflictMessage: (record) =>
      `Bowler \"${record.bowlerName}\" has conflicting duplicate rows; import blocked.`,
    duplicateWarningMessage: (record) =>
      `Bowler \"${record.bowlerName}\" has duplicate identical rows; deduped.`,
  });
  return {
    ...deduped,
    errors: [...deduped.errors, ...invalidRows],
  };
};

const matchScratchMastersParticipants = async (csvRows, dbPeople, headerMapOverride = null) => {
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
  if (normalized.errors.length > 0) {
    return {
      matched: [],
      unmatched: [],
      updates: [],
      warnings: normalized.warnings,
      errors: normalized.errors,
    };
  }
  const nameIndex = buildPersonNameIndex(dbPeople, {
    includeNickname: true,
    withSource: true,
    normalizeName: normalizeScratchMastersName,
  });

  const matched = [];
  const unmatched = [];
  const errors = [];

  for (const row of normalized.rows) {
    const candidates = nameIndex.get(row.nameKey) || [];
    const person = pickBestMatch(candidates);

    if (!person) {
      unmatched.push({
        name: row.bowlerName,
        reason: candidates.length > 1 ? "Multiple participant matches" : "Name not found",
      });
      continue;
    }

    matched.push({
      pid: person.pid,
      name: row.bowlerName,
      scratchMasters: row.scratchMasters,
    });
  }

  const selected = new Map(matched.map((m) => [m.pid, m.scratchMasters]));
  const updates = dbPeople.map((person) => ({
    pid: person.pid,
    scratchMasters: selected.has(person.pid) ? selected.get(person.pid) : 0,
  }));

  return {
    matched,
    unmatched,
    updates,
    warnings: normalized.warnings,
    errors,
  };
};

export {
  REQUIRED_COLUMNS,
  validateColumns,
  normalizeScratchMastersName,
  matchScratchMastersParticipants,
};
