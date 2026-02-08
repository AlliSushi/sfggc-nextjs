const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readFile = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const MENU_PATH = "src/components/Portal/AdminMenu/AdminMenu.js";

test(
  "Given the AdminMenu component, when checking source, then it contains an Email Config link",
  () => {
    const content = readFile(MENU_PATH);
    assert.ok(
      content.includes("Email Config"),
      "AdminMenu must have an 'Email Config' label"
    );
  }
);

test(
  "Given the AdminMenu component, when checking source, then the Email Config link points to /portal/admin/email-config",
  () => {
    const content = readFile(MENU_PATH);
    assert.ok(
      content.includes("/portal/admin/email-config"),
      "AdminMenu must link to /portal/admin/email-config"
    );
  }
);

test(
  "Given the AdminMenu component, when checking source, then the Email Config link is inside a super-admin guard",
  () => {
    const content = readFile(MENU_PATH);
    const emailConfigIndex = content.indexOf("email-config");
    assert.ok(emailConfigIndex > 0, "email-config link must exist");
    const preceding = content.slice(Math.max(0, emailConfigIndex - 500), emailConfigIndex);
    assert.ok(
      preceding.includes("super-admin"),
      "Email Config link must be inside a super-admin conditional block"
    );
  }
);

test(
  "Given the AdminMenu component, when checking source, then the Email Config link appears after the Create Admin link",
  () => {
    const content = readFile(MENU_PATH);
    const createAdminIndex = content.indexOf("Create Admin");
    const emailConfigIndex = content.indexOf("Email Config");
    assert.ok(createAdminIndex > 0, "Create Admin link must exist");
    assert.ok(emailConfigIndex > 0, "Email Config link must exist");
    assert.ok(
      emailConfigIndex > createAdminIndex,
      "Email Config must appear after Create Admin in the menu"
    );
  }
);
