const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readFile = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

// ---------------------------------------------------------------------------
// useAdminSession hook — DRY extraction
// ---------------------------------------------------------------------------

test(
  "Given useAdminSession hook, when checking source, then it fetches /api/portal/admin/session and returns isAdmin and adminRole",
  () => {
    const content = readFile("src/hooks/portal/useAdminSession.js");
    assert.ok(
      content.includes('fetch("/api/portal/admin/session")'),
      "useAdminSession must call the admin session endpoint"
    );
    assert.ok(
      content.includes("isAdmin"),
      "useAdminSession must track isAdmin state"
    );
    assert.ok(
      content.includes("adminRole"),
      "useAdminSession must track adminRole state"
    );
    assert.ok(
      content.includes("return { isAdmin, adminRole }"),
      "useAdminSession must return both isAdmin and adminRole"
    );
  }
);

test(
  "Given participant profile page, when checking source, then it uses the shared useAdminSession hook instead of inline fetch",
  () => {
    const content = readFile("src/pages/portal/participant/[pid].js");
    assert.ok(
      content.includes("useAdminSession"),
      "[pid].js must import and use the useAdminSession hook"
    );
    assert.ok(
      !content.includes('fetch("/api/portal/admin/session")'),
      "[pid].js must not contain an inline fetch to admin/session — use useAdminSession instead"
    );
  }
);

test(
  "Given team page, when checking source, then it uses the shared useAdminSession hook instead of inline fetch",
  () => {
    const content = readFile("src/pages/portal/team/[teamSlug].js");
    assert.ok(
      content.includes("useAdminSession"),
      "[teamSlug].js must import and use the useAdminSession hook"
    );
    assert.ok(
      !content.includes('fetch("/api/portal/admin/session")'),
      "[teamSlug].js must not contain an inline fetch to admin/session — use useAdminSession instead"
    );
  }
);

// ---------------------------------------------------------------------------
// buildBaseUrl SSR utility — DRY extraction
// ---------------------------------------------------------------------------

test(
  "Given ssr-helpers module, when checking source, then buildBaseUrl uses localhost for internal SSR fetches",
  () => {
    const content = readFile("src/utils/portal/ssr-helpers.js");
    assert.ok(
      content.includes("const buildBaseUrl"),
      "ssr-helpers must define buildBaseUrl"
    );
    assert.ok(
      /return\s.*http:\/\/localhost/.test(content),
      "buildBaseUrl must return http://localhost URL for internal SSR fetches (avoids self-referencing nginx loop)"
    );
    assert.ok(
      content.includes("export { buildBaseUrl }"),
      "ssr-helpers must export buildBaseUrl"
    );
  }
);

test(
  "Given participant-page-ssr module, when checking source, then it uses the shared buildBaseUrl utility",
  () => {
    const content = readFile("src/utils/portal/participant-page-ssr.js");
    assert.ok(
      content.includes('from "./ssr-helpers.js"'),
      "participant-page-ssr must import from ssr-helpers"
    );
    assert.ok(
      content.includes("buildBaseUrl(req)"),
      "participant-page-ssr must call buildBaseUrl(req)"
    );
    assert.ok(
      !content.includes("req.headers.host"),
      "participant-page-ssr must not compute base URL inline — use buildBaseUrl"
    );
  }
);

test(
  "Given team-page-ssr module, when checking source, then it uses the shared buildBaseUrl utility",
  () => {
    const content = readFile("src/utils/portal/team-page-ssr.js");
    assert.ok(
      content.includes('from "./ssr-helpers.js"'),
      "team-page-ssr must import from ssr-helpers"
    );
    assert.ok(
      content.includes("buildBaseUrl(req)"),
      "team-page-ssr must call buildBaseUrl(req)"
    );
    assert.ok(
      !content.includes("req.headers.host"),
      "team-page-ssr must not compute base URL inline — use buildBaseUrl"
    );
  }
);

test(
  "Given admin-preview-page-ssr module, when checking source, then it uses the shared buildBaseUrl utility",
  () => {
    const content = readFile("src/utils/portal/admin-preview-page-ssr.js");
    assert.ok(
      content.includes('from "./ssr-helpers.js"'),
      "admin-preview-page-ssr must import from ssr-helpers"
    );
    assert.ok(
      content.includes("buildBaseUrl(req)"),
      "admin-preview-page-ssr must call buildBaseUrl(req)"
    );
    assert.ok(
      !content.includes("req.headers.host"),
      "admin-preview-page-ssr must not compute base URL inline — use buildBaseUrl"
    );
  }
);

// ---------------------------------------------------------------------------
// filterNonNull shared utility — DRY extraction
// ---------------------------------------------------------------------------

test(
  "Given array-helpers module, when checking source, then it exports filterNonNull",
  () => {
    const content = readFile("src/utils/portal/array-helpers.js");
    assert.ok(
      content.includes("const filterNonNull"),
      "array-helpers must define filterNonNull"
    );
    assert.ok(
      content.includes("export { filterNonNull }"),
      "array-helpers must export filterNonNull"
    );
  }
);

test(
  "Given participant-db module, when checking source, then it imports filterNonNull from array-helpers instead of defining it locally",
  () => {
    const content = readFile("src/utils/portal/participant-db.js");
    assert.ok(
      content.includes('from "./array-helpers.js"'),
      "participant-db must import from array-helpers"
    );
    assert.ok(
      !content.match(/const filterNonNull\s*=/),
      "participant-db must not define its own filterNonNull — use the shared utility"
    );
  }
);

test(
  "Given team API module, when checking source, then it imports score extraction from team-scores instead of defining it locally",
  () => {
    const content = readFile("src/pages/api/portal/teams/[teamSlug].js");
    assert.ok(
      content.includes('from "../../../../utils/portal/team-scores.js"'),
      "Team API must import from team-scores"
    );
    assert.ok(
      content.includes("extractTeamScores"),
      "Team API must use extractTeamScores from team-scores"
    );
    assert.ok(
      !content.match(/const filterNonNull\s*=/),
      "Team API must not define its own filterNonNull — use the shared utility"
    );
  }
);

test(
  "Given team-scores module, when checking source, then it imports filterNonNull from array-helpers instead of defining it locally",
  () => {
    const content = readFile("src/utils/portal/team-scores.js");
    assert.ok(
      content.includes('from "./array-helpers.js"'),
      "team-scores must import from array-helpers"
    );
    assert.ok(
      !content.match(/const filterNonNull\s*=/),
      "team-scores must not define its own filterNonNull — use the shared utility"
    );
  }
);

// ---------------------------------------------------------------------------
// TEAM_SIZE constant — meaningful name
// ---------------------------------------------------------------------------

test(
  "Given TeamProfile component, when checking source, then roster slots use a named TEAM_SIZE constant",
  () => {
    const content = readFile("src/components/Portal/TeamProfile/TeamProfile.js");
    assert.ok(
      content.includes("TEAM_SIZE"),
      "TeamProfile must use a named TEAM_SIZE constant"
    );
    assert.ok(
      content.includes("Array.from"),
      "TeamProfile must use Array.from with TEAM_SIZE to build roster slots"
    );
  }
);

// ---------------------------------------------------------------------------
// No duplicate buildBaseUrl inline logic anywhere
// ---------------------------------------------------------------------------

test(
  "Given all SSR modules, when checking for duplicate base URL logic, then none compute protocol and host inline",
  () => {
    const ssrFiles = [
      "src/utils/portal/participant-page-ssr.js",
      "src/utils/portal/team-page-ssr.js",
      "src/utils/portal/admin-preview-page-ssr.js",
    ];
    ssrFiles.forEach((filePath) => {
      const content = readFile(filePath);
      const hasInlineHost = content.includes("req.headers.host") && !content.includes("const buildBaseUrl");
      assert.ok(
        !hasInlineHost,
        `${filePath} must not compute host/protocol inline — use buildBaseUrl from ssr-helpers`
      );
    });
  }
);

// ---------------------------------------------------------------------------
// EM_DASH shared constant extraction
// ---------------------------------------------------------------------------

test(
  "Given display-constants module, when checking source, then it exports EM_DASH",
  () => {
    const content = readFile("src/utils/portal/display-constants.js");
    assert.ok(
      content.includes("EM_DASH"),
      "display-constants must define EM_DASH"
    );
    assert.ok(
      content.includes("export { EM_DASH }"),
      "display-constants must export EM_DASH"
    );
  }
);

test(
  "Given navigation module, when checking source, then it imports EM_DASH from display-constants",
  () => {
    const content = readFile("src/utils/portal/navigation.js");
    assert.ok(
      content.includes('from "./display-constants.js"'),
      "navigation must import EM_DASH from display-constants"
    );
  }
);

test(
  "Given admin clear route helper, when checking source, then it centralizes super-admin clear endpoint boilerplate",
  () => {
    const content = readFile("src/utils/portal/admin-clear-route.js");
    assert.ok(
      content.includes("handleSuperAdminClear"),
      "admin-clear-route must define handleSuperAdminClear"
    );
    assert.ok(
      content.includes("requireSuperAdmin"),
      "admin-clear-route must enforce super-admin authorization"
    );
    assert.ok(
      content.includes("withTransaction"),
      "admin-clear-route must wrap clear operations in a transaction"
    );
  }
);

test(
  "Given audit and scores clear routes, when checking source, then both use shared handleSuperAdminClear helper",
  () => {
    const auditClear = readFile("src/pages/api/portal/admin/audit/clear.js");
    const scoresClear = readFile("src/pages/api/portal/admin/scores/clear.js");
    assert.ok(
      auditClear.includes("handleSuperAdminClear"),
      "audit clear route must use handleSuperAdminClear"
    );
    assert.ok(
      scoresClear.includes("handleSuperAdminClear"),
      "scores clear route must use handleSuperAdminClear"
    );
  }
);

test(
  "Given participant audit API route, when checking source, then it uses a named PARTICIPANT_AUDIT_LIMIT constant",
  () => {
    const content = readFile("src/pages/api/portal/participants/[pid]/audit.js");
    assert.ok(
      content.includes("PARTICIPANT_AUDIT_LIMIT"),
      "participant audit route must define PARTICIPANT_AUDIT_LIMIT constant"
    );
    assert.ok(
      content.includes("limit ?"),
      "participant audit query must parameterize limit using PARTICIPANT_AUDIT_LIMIT"
    );
  }
);
