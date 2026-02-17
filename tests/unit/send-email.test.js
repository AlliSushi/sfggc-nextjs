import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sendTemplatedEmail,
  buildVerifyUrl,
  smtpConfigured,
} from "../../src/utils/portal/send-login-email.js";

const buildMockQuery = (templateRow) => {
  const calls = [];
  const mockQuery = async (sql, params = []) => {
    calls.push({ sql: sql.trim(), params });
    if (sql.includes("select * from email_templates where slug")) {
      return { rows: templateRow ? [templateRow] : [] };
    }
    return { rows: [] };
  };
  mockQuery.calls = calls;
  return mockQuery;
};

const PARTICIPANT_TEMPLATE = {
  slug: "participant-login",
  name: "Participant Login",
  subject: "Your {{email}} login link",
  greeting: "Golden Gate Classic",
  body: "Click below to sign in:",
  button_text: "Sign in",
  footer: "Expires in 30 minutes.",
  html_override: "",
  use_html_override: false,
};

const ADMIN_TEMPLATE = {
  slug: "admin-welcome",
  name: "Admin Welcome",
  subject: "Welcome {{firstName}}!",
  greeting: "Hello {{firstName}}",
  body: "Your password is: {{password}}",
  button_text: "Sign in",
  footer: "Change your password on first login.",
  html_override: "",
  use_html_override: false,
};

test(
  "Given a participant-login template in DB, when sendTemplatedEmail is called, then it reads the template and renders variables",
  async () => {
    const mockQuery = buildMockQuery(PARTICIPANT_TEMPLATE);
    let sentMail = null;

    await sendTemplatedEmail({
      to: "jane@example.com",
      slug: "participant-login",
      variables: { email: "jane@example.com", loginUrl: "https://example.com/verify" },
      buttonUrl: "https://example.com/verify",
      query: mockQuery,
      transport: {
        sendMail: async (opts) => {
          sentMail = opts;
        },
      },
    });

    assert.ok(sentMail, "Should have sent an email");
    assert.equal(sentMail.to, "jane@example.com");
    assert.equal(sentMail.subject, "Your jane@example.com login link");
    assert.ok(sentMail.html.includes("Golden Gate Classic"), "HTML should contain greeting");
    assert.ok(sentMail.html.includes("https://example.com/verify"), "HTML should contain button URL");
  }
);

test(
  "Given an admin-welcome template in DB, when sendTemplatedEmail is called with password, then the password is rendered",
  async () => {
    const mockQuery = buildMockQuery(ADMIN_TEMPLATE);
    let sentMail = null;

    await sendTemplatedEmail({
      to: "admin@example.com",
      slug: "admin-welcome",
      variables: { firstName: "Alice", password: "temp123", loginUrl: "https://example.com" },
      buttonUrl: "https://example.com",
      query: mockQuery,
      transport: {
        sendMail: async (opts) => {
          sentMail = opts;
        },
      },
    });

    assert.ok(sentMail, "Should have sent an email");
    assert.equal(sentMail.subject, "Welcome Alice!");
    assert.ok(sentMail.html.includes("temp123"), "HTML should contain the password");
    assert.ok(sentMail.text.includes("temp123"), "Text should contain the password");
  }
);

test(
  "Given no template in DB for the slug, when sendTemplatedEmail is called, then no email is sent",
  async () => {
    const mockQuery = buildMockQuery(null);
    let sentMail = null;

    await sendTemplatedEmail({
      to: "jane@example.com",
      slug: "nonexistent",
      variables: {},
      query: mockQuery,
      transport: {
        sendMail: async (opts) => {
          sentMail = opts;
        },
      },
    });

    assert.equal(sentMail, null, "Should not send email when no template found");
  }
);

test(
  "Given a template with use_html_override=true, when sendTemplatedEmail is called, then the override HTML is used",
  async () => {
    const overrideTemplate = {
      ...PARTICIPANT_TEMPLATE,
      use_html_override: true,
      html_override: "<div>Custom {{email}} template</div>",
    };
    const mockQuery = buildMockQuery(overrideTemplate);
    let sentMail = null;

    await sendTemplatedEmail({
      to: "jane@example.com",
      slug: "participant-login",
      variables: { email: "jane@example.com" },
      buttonUrl: "https://example.com",
      query: mockQuery,
      transport: {
        sendMail: async (opts) => {
          sentMail = opts;
        },
      },
    });

    assert.ok(sentMail, "Should have sent an email");
    assert.ok(sentMail.html.includes("Custom jane@example.com template"), "Should use override HTML with rendered variables");
  }
);

test(
  "Given buildVerifyUrl is called with a token, when executed, then it returns the correct URL",
  () => {
    const url = buildVerifyUrl("abc123");
    assert.ok(url.includes("/api/portal/participant/verify?token=abc123"));
  }
);

test(
  "Given SMTP env vars are not set, when smtpConfigured is called, then it returns false",
  () => {
    const original = { ...process.env };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    assert.equal(smtpConfigured(), false);
    Object.assign(process.env, original);
  }
);
