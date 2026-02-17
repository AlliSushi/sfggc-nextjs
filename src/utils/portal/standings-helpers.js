const sortByNumericFieldAndName =
  (fieldName) =>
  (a, b) => {
    if (a[fieldName] == null && b[fieldName] == null) return a.name.localeCompare(b.name);
    if (a[fieldName] == null) return 1;
    if (b[fieldName] == null) return -1;
    if (b[fieldName] !== a[fieldName]) return b[fieldName] - a[fieldName];
    return a.name.localeCompare(b.name);
  };

const addRanks = (rows) => {
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
};

export { sortByNumericFieldAndName, addRanks };
