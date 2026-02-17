const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readFile = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

test(
  "Given the admin creation API, when checking source, then it imports sendAdminWelcomeEmail",
  () => {
    const content = readFile("src/pages/api/portal/admins/index.js");
    assert.ok(
      content.includes("sendAdminWelcomeEmail"),
      "Admin creation API must import sendAdminWelcomeEmail"
    );
  }
);

test(
  "Given the admin creation API, when checking source, then the welcome email call passes initialPassword",
  () => {
    const content = readFile("src/pages/api/portal/admins/index.js");
    assert.ok(
      content.includes("initialPassword"),
      "Admin creation API must pass initialPassword to the welcome email"
    );
    assert.ok(
      content.includes("sendAdminWelcomeEmail"),
      "Admin creation API must call sendAdminWelcomeEmail"
    );
  }
);

test(
  "Given the admin creation API, when checking source, then the email send is wrapped in a try-catch (non-fatal)",
  () => {
    const content = readFile("src/pages/api/portal/admins/index.js");
    const emailIndex = content.indexOf("await sendAdminWelcomeEmail(");
    assert.ok(emailIndex > 0, "sendAdminWelcomeEmail must be called");
    const surrounding = content.slice(Math.max(0, emailIndex - 300), emailIndex + 300);
    assert.ok(
      surrounding.includes("try") && surrounding.includes("catch"),
      "sendAdminWelcomeEmail must be inside a try-catch block so email failure does not block admin creation"
    );
  }
);
