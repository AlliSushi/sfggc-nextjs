const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readFile = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const PAGE_PATH = "src/pages/portal/admin/email-config.js";

test(
  "Given the email-config page, when checking source, then it imports PortalShell",
  () => {
    const content = readFile(PAGE_PATH);
    assert.ok(
      content.includes("PortalShell"),
      "Email config page must import PortalShell"
    );
  }
);

test(
  "Given the email-config page, when checking source, then it imports AdminMenu",
  () => {
    const content = readFile(PAGE_PATH);
    assert.ok(
      content.includes("AdminMenu"),
      "Email config page must import AdminMenu"
    );
  }
);

test(
  "Given the email-config page, when checking source, then it imports RootLayout",
  () => {
    const content = readFile(PAGE_PATH);
    assert.ok(
      content.includes("RootLayout"),
      "Email config page must import RootLayout"
    );
  }
);

test(
  "Given the email-config page, when checking source, then it has a super-admin guard in getServerSideProps",
  () => {
    const content = readFile(PAGE_PATH);
    assert.ok(
      content.includes("getServerSideProps"),
      "Email config page must export getServerSideProps"
    );
    assert.ok(
      content.includes("super-admin") || content.includes("requireSuperAdminSSR"),
      "Email config page must check for super-admin role"
    );
  }
);

test(
  "Given the email-config page, when checking source, then it fetches from email-templates API",
  () => {
    const content = readFile(PAGE_PATH);
    assert.ok(
      content.includes("/api/portal/email-templates"),
      "Email config page must fetch from email-templates API"
    );
  }
);

test(
  "Given the email-config page, when checking source, then it has a template selector",
  () => {
    const content = readFile(PAGE_PATH);
    assert.ok(
      content.includes("select") || content.includes("Select"),
      "Email config page must have a template selector"
    );
  }
);

test(
  "Given the email-config page, when checking source, then it has tab navigation for fields, HTML override, and preview",
  () => {
    const content = readFile(PAGE_PATH);
    assert.ok(
      content.includes("nav-tabs") || content.includes("nav-link"),
      "Email config page must use Bootstrap tab navigation"
    );
    assert.ok(
      content.includes("Preview") || content.includes("preview"),
      "Email config page must have a preview tab"
    );
  }
);

test(
  "Given the email-config page, when checking source, then it has form fields for subject, greeting, body, button text, and footer",
  () => {
    const content = readFile(PAGE_PATH);
    assert.ok(content.includes("subject"), "Must have subject field");
    assert.ok(content.includes("greeting"), "Must have greeting field");
    assert.ok(content.includes("body"), "Must have body field");
    assert.ok(content.includes("button_text") || content.includes("buttonText"), "Must have button text field");
    assert.ok(content.includes("footer"), "Must have footer field");
  }
);

test(
  "Given the email-config page, when checking source, then it has an HTML override checkbox and textarea",
  () => {
    const content = readFile(PAGE_PATH);
    assert.ok(
      content.includes("html_override") || content.includes("htmlOverride"),
      "Email config page must have HTML override"
    );
    assert.ok(
      content.includes("use_html_override") || content.includes("useHtmlOverride"),
      "Email config page must have use_html_override toggle"
    );
  }
);

test(
  "Given the email-config page, when checking source, then it has a save button that PUTs to the slug API",
  () => {
    const content = readFile(PAGE_PATH);
    assert.ok(
      content.includes("PUT"),
      "Email config page must use PUT method to save"
    );
    assert.ok(
      content.includes("Save") || content.includes("save"),
      "Email config page must have a save action"
    );
  }
);

test(
  "Given the email-config page, when checking source, then it uses an iframe with srcDoc for preview",
  () => {
    const content = readFile(PAGE_PATH);
    assert.ok(
      content.includes("iframe") || content.includes("srcDoc"),
      "Email config page must use iframe for preview"
    );
  }
);

test(
  "Given the email-config page, when checking source, then it displays available variables hint",
  () => {
    const content = readFile(PAGE_PATH);
    assert.ok(
      content.includes("available_variables") || content.includes("availableVariables"),
      "Email config page must display available variables"
    );
  }
);
