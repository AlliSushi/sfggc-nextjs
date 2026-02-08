import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

describe("Admin Password Reset Email Template", () => {
  const templatesDbPath = resolve(ROOT, "src/utils/portal/email-templates-db.js");
  const templatesDbSrc = readFileSync(templatesDbPath, "utf8");

  it("Given DEFAULT_TEMPLATES, when checked, then includes admin-password-reset slug", () => {
    assert.ok(
      templatesDbSrc.includes('"admin-password-reset"'),
      'DEFAULT_TEMPLATES should include a template with slug "admin-password-reset"'
    );
  });

  it("Given admin-password-reset template, when checked, then has correct available variables", () => {
    assert.ok(
      templatesDbSrc.includes("resetUrl"),
      "Template should include resetUrl variable"
    );
    assert.ok(
      templatesDbSrc.includes("firstName"),
      "Template should include firstName variable"
    );
  });

  it("Given admin-password-reset template, when checked, then has name Admin Password Reset", () => {
    assert.ok(
      templatesDbSrc.includes('"Admin Password Reset"'),
      'Template should have name "Admin Password Reset"'
    );
  });
});

describe("sendPasswordResetEmail function", () => {
  const sendEmailPath = resolve(ROOT, "src/utils/portal/send-login-email.js");
  const sendEmailSrc = readFileSync(sendEmailPath, "utf8");

  it("Given send-login-email module, when checked, then exports sendPasswordResetEmail", () => {
    assert.ok(
      sendEmailSrc.includes("sendPasswordResetEmail"),
      "Module should export sendPasswordResetEmail function"
    );
  });

  it("Given send-login-email module, when checked, then exports buildResetUrl", () => {
    assert.ok(
      sendEmailSrc.includes("buildResetUrl"),
      "Module should export buildResetUrl helper"
    );
  });

  it("Given sendPasswordResetEmail, when checked, then uses admin-password-reset slug", () => {
    assert.ok(
      sendEmailSrc.includes('"admin-password-reset"'),
      'sendPasswordResetEmail should use slug "admin-password-reset"'
    );
  });

  it("Given buildResetUrl, when checked, then builds URL with /portal/admin/reset path", () => {
    assert.ok(
      sendEmailSrc.includes("/portal/admin/reset?token="),
      "buildResetUrl should construct URL with /portal/admin/reset?token= path"
    );
  });
});

describe("Email Config preview support", () => {
  const emailConfigPath = resolve(ROOT, "src/pages/portal/admin/email-config.js");
  const emailConfigSrc = readFileSync(emailConfigPath, "utf8");

  it("Given SAMPLE_VARIABLES, when checked, then includes admin-password-reset key", () => {
    assert.ok(
      emailConfigSrc.includes('"admin-password-reset"'),
      'SAMPLE_VARIABLES should have an "admin-password-reset" key for preview'
    );
  });

  it("Given admin-password-reset sample variables, when checked, then includes resetUrl", () => {
    assert.ok(
      emailConfigSrc.includes("resetUrl"),
      "admin-password-reset sample variables should include resetUrl"
    );
  });
});
