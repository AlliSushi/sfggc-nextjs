const validateRequiredColumns = (headers, requiredColumns) => {
  const missing = requiredColumns.filter((column) => !headers.includes(column));
  return { valid: missing.length === 0, missing };
};

/** Null import value should not overwrite an existing database value. */
const wouldClobberExisting = (newValue, oldValue) =>
  newValue === null && oldValue !== null;

export { validateRequiredColumns, wouldClobberExisting };
