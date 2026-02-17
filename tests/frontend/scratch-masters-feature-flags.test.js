const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SM_PAGE = path.join(process.cwd(), "src/pages/portal/admin/scratch-masters.js");
const SM_API = path.join(process.cwd(), "src/pages/api/portal/admin/scratch-masters.js");
const PARTICIPANT_PAGE = path.join(process.cwd(), "src/pages/portal/participant/[pid].js");
const PARTICIPANT_PROFILE = path.join(process.cwd(), "src/components/Portal/ParticipantProfile/ParticipantProfile.js");
const PARTICIPANT_EDIT = path.join(process.cwd(), "src/components/Portal/ParticipantEditForm/ParticipantEditForm.js");

const read = (p) => fs.readFileSync(p, "utf8");

test("Given scratch masters admin page, when rendering controls, then Import button appears before On/Off toggle", () => {
  const content = read(SM_PAGE);
  const importIndex = content.indexOf("Import Scratch Masters");
  const toggleIndex = content.indexOf('participantsCanViewScratchMasters ? "On" : "Off"');

  assert.ok(importIndex >= 0, "Scratch Masters page should render Import Scratch Masters control");
  assert.ok(toggleIndex >= 0, "Scratch Masters page should render On/Off toggle");
  assert.ok(importIndex < toggleIndex, "Import Scratch Masters control should appear before On/Off toggle");
});

test("Given scratch masters page, when rendering rank table, then it includes separators between top 8, substitute, and non-qualified rows", () => {
  const content = read(SM_PAGE);
  assert.ok(content.includes("scratch-cutoff-row"), "Scratch Masters page should include visual cutoff rows");
  assert.ok(content.includes('height: "6px"'), "Scratch Masters page cutoff rows should be slim");
  assert.ok(
    content.includes("SCRATCH_CUTOFF_BREAK_RANKS"),
    "Scratch Masters page should use a named constant for cutoff break ranks"
  );
  assert.ok(
    content.includes("SCRATCH_TABLE_COLUMN_COUNT"),
    "Scratch Masters page should use a named constant for table column count"
  );
  assert.ok(
    content.includes("SCRATCH_TABLE_HEADERS.length"),
    "Scratch Masters page should derive table column count from header definitions"
  );
  assert.ok(
    !content.includes("const SCRATCH_TABLE_COLUMN_COUNT = 13"),
    "Scratch Masters page should avoid hard-coded colSpan magic numbers"
  );
});

test("Given scratch masters API, when selecting participants, then only scratch masters eligible participants are returned", () => {
  const content = read(SM_API);
  assert.match(content, /where[\s\S]*p\.scratch_masters\s*=\s*1/i);
});

test("Given participant profile components, when rendering scratch masters actions, then all participants see Scratch Masters button when sharing is enabled", () => {
  const page = read(PARTICIPANT_PAGE);
  const profile = read(PARTICIPANT_PROFILE);

  assert.ok(page.includes("scratchMastersVisibleToParticipants"), "Participant page should carry scratch masters visibility prop");
  assert.ok(
    page.includes("showScratchMastersLink={isAdmin || scratchMastersVisibleToParticipants}"),
    "Participant page should set showScratchMastersLink from admin status or global sharing setting"
  );
  assert.ok(
    !page.includes("Boolean(participant?.scratchMasters)"),
    "Participant page should not require participant-level scratch masters eligibility for the button"
  );
  assert.ok(profile.includes("View Scratch Masters"), "Participant profile should render Scratch Masters CTA");
});

test("Given participant edit form for admins, when rendering fields, then it includes a Scratch Masters yes/no control", () => {
  const form = read(PARTICIPANT_EDIT);
  assert.ok(form.includes("Scratch Masters"), "Participant edit form should include Scratch Masters field label");
  assert.ok(
    form.includes("scratchMasters") || form.includes("scratch_masters"),
    "Participant edit form should bind Scratch Masters value"
  );
});
