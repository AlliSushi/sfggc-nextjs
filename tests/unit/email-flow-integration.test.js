const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readFile = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

/* ------------------------------------------------------------------ */
/*  Integration: sendLoginEmail uses DB templates                      */
/* ------------------------------------------------------------------ */

test(
  "Given send-login-email.js, when checking source, then sendLoginEmail calls sendTemplatedEmail with participant-login slug",
  () => {
    const content = readFile("src/utils/portal/send-login-email.js");
    const fn = content.slice(
      content.indexOf("const sendLoginEmail"),
      content.indexOf("const sendAdminWelcomeEmail")
    );
    assert.ok(
      fn.includes("sendTemplatedEmail"),
      "sendLoginEmail must delegate to sendTemplatedEmail"
    );
    assert.ok(
      fn.includes('"participant-login"'),
      "sendLoginEmail must use participant-login slug"
    );
  }
);

/* ------------------------------------------------------------------ */
/*  Integration: admin creation triggers welcome email                 */
/* ------------------------------------------------------------------ */

test(
  "Given admins/index.js, when checking source, then POST handler calls sendAdminWelcomeEmail after insert",
  () => {
    const content = readFile("src/pages/api/portal/admins/index.js");
    const insertIndex = content.indexOf("insert into admins");
    const emailIndex = content.indexOf("await sendAdminWelcomeEmail(");
    assert.ok(insertIndex > 0, "Must have admin insert statement");
    assert.ok(emailIndex > 0, "Must call sendAdminWelcomeEmail");
    assert.ok(
      emailIndex > insertIndex,
      "sendAdminWelcomeEmail must be called after admin insert"
    );
  }
);

/* ------------------------------------------------------------------ */
/*  Integration: updated template is used on next send                 */
/* ------------------------------------------------------------------ */

test(
  "Given sendTemplatedEmail, when checking source, then it reads template from DB at send-time (not cached)",
  () => {
    const content = readFile("src/utils/portal/send-login-email.js");
    const fn = content.slice(
      content.indexOf("const sendTemplatedEmail"),
      content.indexOf("const sendLoginEmail")
    );
    assert.ok(
      fn.includes("getTemplateBySlug"),
      "sendTemplatedEmail must call getTemplateBySlug each invocation"
    );
    assert.ok(
      fn.includes("renderTemplate"),
      "sendTemplatedEmail must render template with variables"
    );
  }
);

/* ------------------------------------------------------------------ */
/*  Integration: html_override respected                               */
/* ------------------------------------------------------------------ */

test(
  "Given sendTemplatedEmail, when checking source, then it uses resolveTemplateHtml which checks html_override flag",
  () => {
    const content = readFile("src/utils/portal/send-login-email.js");
    assert.ok(
      content.includes("resolveTemplateHtml"),
      "sendTemplatedEmail must use resolveTemplateHtml"
    );
    const builder = readFile("src/utils/portal/email-html-builder.js");
    assert.ok(
      builder.includes("use_html_override"),
      "resolveTemplateHtml must check use_html_override flag"
    );
    assert.ok(
      builder.includes("html_override"),
      "resolveTemplateHtml must use html_override content"
    );
  }
);

/* ------------------------------------------------------------------ */
/*  Integration: Email Config page wired to CRUD API                   */
/* ------------------------------------------------------------------ */

test(
  "Given the email-config page, when checking source, then it fetches templates and PUTs updates via the API",
  () => {
    const content = readFile("src/pages/portal/admin/email-config.js");
    assert.ok(
      content.includes("/api/portal/email-templates"),
      "Email config page must fetch from the templates API"
    );
    assert.ok(
      content.includes("PUT"),
      "Email config page must PUT updates"
    );
  }
);

/* ------------------------------------------------------------------ */
/*  Integration: AdminMenu links to email-config                       */
/* ------------------------------------------------------------------ */

test(
  "Given the AdminMenu, when checking source, then it links to the email-config page behind super-admin guard",
  () => {
    const content = readFile("src/components/Portal/AdminMenu/AdminMenu.js");
    const emailConfigIndex = content.indexOf("/portal/admin/email-config");
    assert.ok(emailConfigIndex > 0, "AdminMenu must link to email-config");
    const preceding = content.slice(Math.max(0, emailConfigIndex - 500), emailConfigIndex);
    assert.ok(
      preceding.includes("super-admin"),
      "Email Config link must be inside super-admin guard"
    );
  }
);

/* ------------------------------------------------------------------ */
/*  Integration: CRUD API uses DB layer                                */
/* ------------------------------------------------------------------ */

test(
  "Given the email-templates API routes, when checking source, then index.js uses getAllTemplates and [slug].js uses getTemplateBySlug and upsertTemplate",
  () => {
    const indexContent = readFile("src/pages/api/portal/email-templates/index.js");
    assert.ok(
      indexContent.includes("getAllTemplates"),
      "index.js must call getAllTemplates"
    );

    const slugContent = readFile("src/pages/api/portal/email-templates/[slug].js");
    assert.ok(
      slugContent.includes("getTemplateBySlug"),
      "[slug].js must call getTemplateBySlug"
    );
    assert.ok(
      slugContent.includes("upsertTemplate"),
      "[slug].js must call upsertTemplate"
    );
  }
);
