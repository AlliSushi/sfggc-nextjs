const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MENU_PATH = path.join(
  process.cwd(),
  "src/components/Portal/AdminMenu/AdminMenu.js"
);

const readMenu = () => fs.readFileSync(MENU_PATH, "utf8");

test("Given the AdminMenu component, when checking source, then it includes an Optional Events menu item", () => {
  const content = readMenu();
  assert.ok(content.includes("Optional Events"), "AdminMenu must include Optional Events menu text");
});

test("Given the AdminMenu component, when checking source, then Optional Events links to the admin route", () => {
  const content = readMenu();
  assert.ok(
    content.includes("/portal/admin/optional-events"),
    "AdminMenu Optional Events item must link to /portal/admin/optional-events"
  );
});

test("Given the AdminMenu component, when rendering standings-related entries, then Optional Events and Scratch Masters appear before Standings", () => {
  const content = readMenu();
  const optionalIndex = content.indexOf("Optional Events");
  const scratchIndex = content.indexOf("Scratch Masters");
  const standingsIndex = content.indexOf("Standings");

  assert.ok(optionalIndex >= 0, "AdminMenu must include Optional Events");
  assert.ok(scratchIndex >= 0, "AdminMenu must include Scratch Masters");
  assert.ok(standingsIndex >= 0, "AdminMenu must include Standings");
  assert.ok(
    optionalIndex < scratchIndex && scratchIndex < standingsIndex,
    "AdminMenu should group standings-related items in the order Optional Events, Scratch Masters, Standings"
  );
});
