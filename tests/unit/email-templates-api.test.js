const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readFile = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

/* ------------------------------------------------------------------ */
/*  index.js — GET list all                                            */
/* ------------------------------------------------------------------ */

test(
  "Given the email-templates index API, when checking source, then it imports requireSuperAdmin",
  () => {
    const content = readFile("src/pages/api/portal/email-templates/index.js");
    assert.ok(
      content.includes("requireSuperAdmin"),
      "Email templates index API must use requireSuperAdmin guard"
    );
  }
);

test(
  "Given the email-templates index API, when checking source, then it imports methodNotAllowed",
  () => {
    const content = readFile("src/pages/api/portal/email-templates/index.js");
    assert.ok(
      content.includes("methodNotAllowed"),
      "Email templates index API must use methodNotAllowed"
    );
  }
);

test(
  "Given the email-templates index API, when checking source, then it calls getAllTemplates",
  () => {
    const content = readFile("src/pages/api/portal/email-templates/index.js");
    assert.ok(
      content.includes("getAllTemplates"),
      "Email templates index API must call getAllTemplates"
    );
  }
);

test(
  "Given the email-templates index API, when checking source, then it only allows GET",
  () => {
    const content = readFile("src/pages/api/portal/email-templates/index.js");
    assert.ok(
      content.includes('"GET"'),
      "Email templates index API must check for GET method"
    );
    assert.ok(
      content.includes("methodNotAllowed"),
      "Email templates index API must reject non-GET methods"
    );
  }
);

/* ------------------------------------------------------------------ */
/*  [slug].js — GET single + PUT update                                */
/* ------------------------------------------------------------------ */

test(
  "Given the email-templates [slug] API, when checking source, then it imports requireSuperAdmin",
  () => {
    const content = readFile("src/pages/api/portal/email-templates/[slug].js");
    assert.ok(
      content.includes("requireSuperAdmin"),
      "Email templates slug API must use requireSuperAdmin guard"
    );
  }
);

test(
  "Given the email-templates [slug] API, when checking source, then it handles GET and PUT methods",
  () => {
    const content = readFile("src/pages/api/portal/email-templates/[slug].js");
    assert.ok(
      content.includes('"GET"') && content.includes('"PUT"'),
      "Email templates slug API must handle GET and PUT"
    );
    assert.ok(
      content.includes("methodNotAllowed"),
      "Email templates slug API must reject other methods"
    );
  }
);

test(
  "Given the email-templates [slug] API, when checking source, then GET calls getTemplateBySlug",
  () => {
    const content = readFile("src/pages/api/portal/email-templates/[slug].js");
    assert.ok(
      content.includes("getTemplateBySlug"),
      "Email templates slug API must call getTemplateBySlug for GET"
    );
  }
);

test(
  "Given the email-templates [slug] API, when checking source, then PUT calls upsertTemplate",
  () => {
    const content = readFile("src/pages/api/portal/email-templates/[slug].js");
    assert.ok(
      content.includes("upsertTemplate"),
      "Email templates slug API must call upsertTemplate for PUT"
    );
  }
);

test(
  "Given the email-templates [slug] API, when checking source, then PUT validates subject is required",
  () => {
    const content = readFile("src/pages/api/portal/email-templates/[slug].js");
    assert.ok(
      content.includes("subject"),
      "Email templates slug API must validate subject field"
    );
    assert.ok(
      content.includes("400"),
      "Email templates slug API must return 400 for missing subject"
    );
  }
);

test(
  "Given the email-templates [slug] API, when checking source, then GET returns 404 for unknown slug",
  () => {
    const content = readFile("src/pages/api/portal/email-templates/[slug].js");
    assert.ok(
      content.includes("404"),
      "Email templates slug API must return 404 for unknown template"
    );
  }
);

test(
  "Given the email-templates [slug] API, when checking source, then it reads slug from req.query",
  () => {
    const content = readFile("src/pages/api/portal/email-templates/[slug].js");
    assert.ok(
      content.includes("req.query"),
      "Email templates slug API must read slug from req.query"
    );
  }
);
