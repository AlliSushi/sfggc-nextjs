const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MENU_PATH = path.join(
  process.cwd(),
  "src/components/Portal/AdminMenu/AdminMenu.js"
);

const readMenu = () => fs.readFileSync(MENU_PATH, "utf8");

test(
  "Given the AdminMenu component, when checking source, then it contains a Scratch Masters menu item",
  () => {
    const content = readMenu();
    assert.ok(
      content.includes("Scratch Masters"),
      "AdminMenu must include a Scratch Masters menu item"
    );
  }
);

test(
  "Given the AdminMenu component, when checking source, then Scratch Masters links to the admin page route",
  () => {
    const content = readMenu();
    assert.ok(
      content.includes("/portal/admin/scratch-masters"),
      "AdminMenu Scratch Masters item must link to /portal/admin/scratch-masters"
    );
  }
);
