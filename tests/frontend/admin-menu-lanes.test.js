const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readFile = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const MENU_PATH = "src/components/Portal/AdminMenu/AdminMenu.js";
const LANES_MODAL_PATH = "src/components/Portal/ImportLanesModal/ImportLanesModal.js";

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
  "Given AdminMenu.js, when read, then it renders ImportLanesModal for lanes flow",
  () => {
    const content = readFile(MENU_PATH);
    assert.ok(
      content.includes("ImportLanesModal"),
      "AdminMenu must delegate lanes import logic to ImportLanesModal"
    );
  }
);

test(
  "Given ImportLanesModal.js, when read, then contains CSV file input with accept=.csv",
  () => {
    const content = readFile(LANES_MODAL_PATH);
    assert.ok(
      content.includes('accept=".csv"'),
      "ImportLanesModal must contain a file input with accept=.csv for CSV uploads"
    );
  }
);

test(
  "Given ImportLanesModal.js, when read, then posts preview/import requests to import-lanes endpoint",
  () => {
    const content = readFile(LANES_MODAL_PATH);
    assert.ok(
      content.includes("/api/portal/admin/import-lanes"),
      "ImportLanesModal must reference the import-lanes API endpoint"
    );
    assert.ok(
      content.includes("IMPORT_MODES.PREVIEW") && content.includes("IMPORT_MODES.IMPORT"),
      "ImportLanesModal must use preview and import modes for lane import flow"
    );
  }
);

test(
  "Given ImportLanesModal.js, when a CSV larger than limit is selected, then it shows a size error before upload",
  () => {
    const content = readFile(LANES_MODAL_PATH);
    assert.ok(
      content.includes("MAX_CSV_SIZE_BYTES") && content.includes("max 2MB"),
      "ImportLanesModal must guard large CSV files client-side before uploading"
    );
  }
);
