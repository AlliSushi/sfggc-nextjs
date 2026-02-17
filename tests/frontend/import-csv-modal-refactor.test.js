const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const GENERIC_MODAL = path.join(
  process.cwd(),
  "src/components/Portal/ImportCsvModal/ImportCsvModal.js"
);
const OPTIONAL_MODAL = path.join(
  process.cwd(),
  "src/components/Portal/ImportOptionalEventsModal/ImportOptionalEventsModal.js"
);
const SCRATCH_MODAL = path.join(
  process.cwd(),
  "src/components/Portal/ImportScratchMastersModal/ImportScratchMastersModal.js"
);

const read = (p) => fs.readFileSync(p, "utf8");

test("Given import modal refactor, when checking files, then generic ImportCsvModal exists", () => {
  assert.ok(fs.existsSync(GENERIC_MODAL), "Generic ImportCsvModal component should exist");
});

test("Given import modal wrappers, when checking source, then Optional Events and Scratch Masters wrappers use ImportCsvModal", () => {
  const optional = read(OPTIONAL_MODAL);
  const scratch = read(SCRATCH_MODAL);

  assert.ok(optional.includes("ImportCsvModal"), "Optional Events modal should use ImportCsvModal");
  assert.ok(scratch.includes("ImportCsvModal"), "Scratch Masters modal should use ImportCsvModal");
});

test("Given import modal auth handling, when checking generic modal source, then portalFetch is used with opt-in auth response handling", () => {
  const generic = read(GENERIC_MODAL);
  assert.ok(generic.includes("portalFetch"), "Generic import modal should use portalFetch");
  assert.ok(
    generic.includes("allowAuthErrorResponses: true"),
    "Generic import modal should opt out of redirect for import auth errors"
  );
});
