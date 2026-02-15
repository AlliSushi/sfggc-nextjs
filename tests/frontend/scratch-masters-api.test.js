const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const API_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/admin/scratch-masters.js"
);

const readApi = () => fs.readFileSync(API_PATH, "utf8");

test(
  "Given scratch masters API route, when checking filesystem, then file exists at expected path",
  () => {
    assert.ok(
      fs.existsSync(API_PATH),
      "Scratch Masters API must exist at src/pages/api/portal/admin/scratch-masters.js"
    );
  }
);

test(
  "Given scratch masters API route, when checking auth, then participants are allowed only when visibility is enabled",
  () => {
    const content = readApi();
    assert.ok(
      content.includes("requireAnySession"),
      "Scratch Masters API must require any valid portal session"
    );
    assert.ok(
      content.includes("getScratchMastersVisibleToParticipants"),
      "Scratch Masters API must read scratch masters visibility setting"
    );
    assert.ok(
      content.includes("forbidden(res)"),
      "Scratch Masters API must return forbidden when participant access is disabled"
    );
  }
);

test(
  "Given scratch masters API route, when request method is not GET, then methodNotAllowed is used",
  () => {
    const content = readApi();
    assert.ok(
      content.includes("methodNotAllowed"),
      "Scratch Masters API must use methodNotAllowed for unsupported methods"
    );
  }
);

test(
  "Given scratch masters visibility API route, when checking source, then admins can GET and PUT participants visibility setting",
  () => {
    const visibilityPath = path.join(
      process.cwd(),
      "src/pages/api/portal/admin/scratch-masters/visibility.js"
    );
    assert.ok(
      fs.existsSync(visibilityPath),
      "Scratch Masters visibility API must exist"
    );
    const content = fs.readFileSync(visibilityPath, "utf8");
    assert.ok(
      content.includes("createVisibilityToggleHandler"),
      "Scratch Masters visibility API should use shared route factory"
    );
    assert.ok(
      content.includes("valueKey: \"participantsCanViewScratchMasters\""),
      "Scratch Masters visibility API should configure participantsCanViewScratchMasters key"
    );
    assert.ok(
      content.includes("participantsCanViewScratchMasters"),
      "Scratch Masters visibility API must read/write participantsCanViewScratchMasters"
    );
  }
);

test(
  "Given scratch masters API route, when building response, then it delegates cumulative ranking to buildScratchMasters",
  () => {
    const content = readApi();
    assert.ok(
      content.includes("buildScratchMasters"),
      "Scratch Masters API must call buildScratchMasters to produce standings"
    );
  }
);

test(
  "Given scratch masters API route, when selecting score rows, then event_type is queried for team/doubles/singles game columns",
  () => {
    const content = readApi();
    assert.ok(
      content.includes("s.event_type"),
      "Scratch Masters API must select s.event_type so game columns can be mapped to T/D/S buckets"
    );
  }
);
