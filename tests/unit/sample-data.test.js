const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const parseLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
};

test("Given CSV sample data, when parsing, then participants load", () => {
  const filePath = path.join(
    process.cwd(),
    "portal_docs",
    "sample_data",
    "SFGGC Sample Table - EventEntries.csv"
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = parseLine(lines[0]);
  const firstRow = parseLine(lines[1]);

  assert.ok(headers.includes("PID"));
  assert.ok(firstRow.length > 0);
});
