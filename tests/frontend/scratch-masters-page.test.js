const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PAGE_PATH = path.join(
  process.cwd(),
  "src/pages/portal/admin/scratch-masters.js"
);

const readPage = () => fs.readFileSync(PAGE_PATH, "utf8");

test(
  "Given scratch masters page, when checking filesystem, then the page exists at the admin route",
  () => {
    assert.ok(
      fs.existsSync(PAGE_PATH),
      "Scratch Masters page must exist at src/pages/portal/admin/scratch-masters.js"
    );
  }
);

test(
  "Given scratch masters page, when checking auth guard, then participant access is controlled by a visibility setting",
  () => {
    const content = readPage();
    assert.ok(
      content.includes("requireSessionWithVisibilitySSR"),
      "Scratch Masters page SSR should use shared visibility SSR helper"
    );
    assert.ok(
      content.includes("getScratchMastersVisibleToParticipants"),
      "Scratch Masters page SSR must read scratch masters visibility setting"
    );
    assert.ok(
      content.includes("visibilityPropName: \"initialParticipantsCanViewScratchMasters\""),
      "Scratch Masters page should pass visibility prop name to shared helper"
    );
  }
);

test(
  "Given scratch masters page, when loading data, then it requests the scratch masters API and includes an admin visibility toggle",
  () => {
    const content = readPage();
    assert.ok(
      content.includes("/api/portal/admin/scratch-masters"),
      "Scratch Masters page must fetch /api/portal/admin/scratch-masters"
    );
    assert.ok(
      content.includes("/api/portal/admin/scratch-masters/visibility"),
      "Scratch Masters page must call visibility API when admins toggle access"
    );
    assert.ok(
      content.includes("participantsCanViewScratchMasters ? \"On\" : \"Off\""),
      "Scratch Masters page must show On/Off visibility toggle state"
    );
    assert.ok(
      content.includes("useVisibilityToggle"),
      "Scratch Masters page should use shared visibility toggle hook"
    );
    assert.ok(
      content.includes("useCallback"),
      "Scratch Masters page should memoize loadScratchMasters for stable useEffect dependencies"
    );
    assert.match(
      content,
      /useEffect\(\(\)\s*=>\s*\{\s*loadScratchMasters\(\);\s*\},\s*\[loadScratchMasters\]\s*\)/s,
      "Scratch Masters page useEffect should depend on loadScratchMasters"
    );
  }
);

test(
  "Given scratch masters page, when rendering standings, then it groups output by division and shows cumulative columns",
  () => {
    const content = readPage();
    assert.ok(
      content.includes("DIVISION_LABELS"),
      "Scratch Masters page must render division headings"
    );
    assert.ok(
      content.includes("Scratch Total"),
      "Scratch Masters page must include a Scratch Total column"
    );
    assert.ok(
      !content.includes("HDCP") && content.includes('"Total"'),
      "Scratch Masters page must not include HDCP and must still include Total"
    );
    assert.ok(
      content.includes("SCRATCH_TABLE_HEADERS") &&
        content.includes('"T1"') &&
        content.includes('"T2"') &&
        content.includes('"T3"') &&
        content.includes('"D1"') &&
        content.includes('"D2"') &&
        content.includes('"D3"') &&
        content.includes('"S1"') &&
        content.includes('"S2"') &&
        content.includes('"S3"'),
      "Scratch Masters page must include per-event game columns for team, doubles, and singles"
    );
    assert.ok(
      content.includes("formatScore(entry.t1)") &&
        content.includes("formatScore(entry.d1)") &&
        content.includes("formatScore(entry.s1)"),
      "Scratch Masters page must render per-event game cells using EM_DASH fallback formatter"
    );
  }
);
