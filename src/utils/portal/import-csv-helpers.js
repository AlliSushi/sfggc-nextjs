const validateRequiredColumns = (headers, requiredColumns) => {
  const missing = requiredColumns.filter((column) => !headers.includes(column));
  return { valid: missing.length === 0, missing };
};

const resolveHeader = (headers, target, headerAliases = {}) => {
  const aliases = headerAliases[target] || [target];
  return aliases.find((alias) => headers.includes(alias)) || null;
};

const validateColumnsWithAliases = (
  headers,
  requiredColumns,
  headerAliases = {}
) => {
  const headerMap = requiredColumns.reduce((acc, column) => {
    acc[column] = resolveHeader(headers, column, headerAliases);
    return acc;
  }, {});
  const missing = requiredColumns.filter((column) => !headerMap[column]);
  return { valid: missing.length === 0, missing, headerMap };
};

const normalizeImportName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const buildPersonNameIndex = (
  dbPeople,
  {
    includeNickname = false,
    withSource = false,
    normalizeName = normalizeImportName,
    buildCompositeKey = (firstName, lastName, normalize) =>
      normalize(`${firstName || ""} ${lastName || ""}`),
  } = {}
) => {
  const index = new Map();

  const add = (key, person, source = "first") => {
    if (!key) return;
    const existing = index.get(key) || [];
    if (withSource) {
      if (!existing.some((entry) => entry.person.pid === person.pid && entry.source === source)) {
        existing.push({ person, source });
      }
    } else if (!existing.some((entry) => entry.pid === person.pid)) {
      existing.push(person);
    }
    index.set(key, existing);
  };

  for (const person of dbPeople || []) {
    add(
      buildCompositeKey(person.first_name, person.last_name, normalizeName),
      person,
      "first"
    );
    if (includeNickname && person.nickname) {
      add(
        buildCompositeKey(person.nickname, person.last_name, normalizeName),
        person,
        "nickname"
      );
    }
  }

  return index;
};

const dedupeRowsByKey = ({
  rows,
  toRecord,
  getKey,
  rowsConflict,
  missingRowWarning,
  duplicateConflictMessage,
  duplicateWarningMessage,
}) => {
  const byKey = new Map();
  const warnings = [];
  const errors = [];

  for (const rawRow of rows || []) {
    const record = toRecord(rawRow);
    if (!record) {
      if (missingRowWarning) {
        const message = missingRowWarning(rawRow);
        if (message) warnings.push(message);
      }
      continue;
    }

    const key = getKey(record);
    if (!byKey.has(key)) {
      byKey.set(key, record);
      continue;
    }

    const existing = byKey.get(key);
    if (rowsConflict(existing, record)) {
      errors.push(duplicateConflictMessage(record, existing));
      continue;
    }
    if (duplicateWarningMessage) {
      warnings.push(duplicateWarningMessage(record, existing));
    }
  }

  return { rows: [...byKey.values()], warnings, errors };
};

/** Null import value should not overwrite an existing database value. */
const wouldClobberExisting = (newValue, oldValue) =>
  newValue === null && oldValue !== null;

export {
  validateRequiredColumns,
  validateColumnsWithAliases,
  resolveHeader,
  normalizeImportName,
  buildPersonNameIndex,
  dedupeRowsByKey,
  wouldClobberExisting,
};
