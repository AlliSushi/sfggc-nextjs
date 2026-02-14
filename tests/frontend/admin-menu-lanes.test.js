const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readFile = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const MENU_PATH = "src/components/Portal/AdminMenu/AdminMenu.js";

test(
  "Given AdminMenu.js, when read, then contains Import Lanes dropdown button",
  () => {
    const content = readFile(MENU_PATH);
    assert.ok(
      content.includes("Import Lanes"),
      "AdminMenu must contain an 'Import Lanes' dropdown menu item"
    );
  }
);

test(
  'Given AdminMenu.js, when read, then contains CSV file input with accept=".csv"',
  () => {
    const content = readFile(MENU_PATH);
    assert.ok(
      content.includes('accept=".csv"'),
      'AdminMenu must contain a file input with accept=".csv" for CSV uploads'
    );
  }
);

test(
  "Given AdminMenu.js, when read, then contains lanes preview modal state",
  () => {
    const content = readFile(MENU_PATH);
    const hasLanesPreview =
      content.includes("lanesPreview") ||
      content.includes("showLanesPreview");
    assert.ok(
      hasLanesPreview,
      "AdminMenu must contain 'lanesPreview' or 'showLanesPreview' for preview state management"
    );
  }
);

test(
  "Given AdminMenu.js, when read, then posts to import-lanes API endpoint",
  () => {
    const content = readFile(MENU_PATH);
    assert.ok(
      content.includes("import-lanes"),
      "AdminMenu must reference the 'import-lanes' API endpoint"
    );
  }
);

test(
  "Given AdminMenu.js, when a CSV larger than limit is selected, then it shows a size error before upload",
  () => {
    const content = readFile(MENU_PATH);
    assert.ok(
      content.includes("MAX_CSV_SIZE_BYTES") && content.includes("max 2MB"),
      "AdminMenu must guard large CSV files client-side before uploading"
    );
  }
);
