const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const savedEnv = {};
const envKeys = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "PORTAL_BASE_URL",
];

const saveEnv = () => {
  envKeys.forEach((key) => {
    savedEnv[key] = process.env[key];
  });
};

const restoreEnv = () => {
  envKeys.forEach((key) => {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  });
};

const clearSmtpEnv = () => {
  envKeys.forEach((key) => delete process.env[key]);
  process.env.PORTAL_BASE_URL = "http://localhost:3000";
};

const setSmtpEnv = () => {
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "user@example.com";
  process.env.SMTP_PASS = "password123";
  process.env.SMTP_FROM = "Test <test@example.com>";
  process.env.PORTAL_BASE_URL = "https://www.goldengateclassic.org";
};

/**
 * Load the module fresh each time (with cache-busting query param)
 * so env vars are re-read.
 */
let importCounter = 0;
const loadModule = async () => {
  const fullPath = path.join(
    process.cwd(),
    "src/utils/portal/send-login-email.js"
  );
  const url = `${pathToFileURL(fullPath)}?t=${Date.now()}_${importCounter++}`;
  return import(url);
};

/**
 * Mock query that returns the default participant-login template
 * when email_templates is queried by slug.
 */
const buildMockQuery = () => {
  const defaultTemplate = {
    slug: "participant-login",
    name: "Participant Login",
    subject: "Your Golden Gate Classic login link",
    greeting: "Golden Gate Classic",
    body: "Click the link below to sign in to the tournament portal:",
    button_text: "Sign in to the portal",
    footer: "This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.",
    html_override: "",
    use_html_override: false,
    available_variables: '["loginUrl","firstName","email"]',
  };
  return async (sql, params = []) => {
    if (sql.includes("select * from email_templates where slug")) {
      return { rows: [defaultTemplate] };
    }
    return { rows: [] };
  };
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  saveEnv();
});

afterEach(() => {
  restoreEnv();
});

test(
  "Given SMTP is not configured, when sendLoginEmail is called, then the verify URL is logged to console",
  async () => {
    clearSmtpEnv();

    const logged = [];
    const origLog = console.log;
    console.log = (...args) => logged.push(args.join(" "));

    try {
      const { sendLoginEmail } = await loadModule();
      await sendLoginEmail({ email: "bowler@example.com", token: "abc123", query: buildMockQuery() });

      const allOutput = logged.join("\n");
      assert.ok(
        allOutput.includes("participant-login"),
        "Console output should mention the template slug"
      );
      assert.ok(
        allOutput.includes("bowler@example.com"),
        "Console output should mention the email address"
      );
      assert.ok(
        allOutput.includes("Subject:"),
        "Console output should log the rendered subject"
      );
    } finally {
      console.log = origLog;
    }
  }
);

test(
  "Given SMTP is configured, when sendLoginEmail is called, then nodemailer sends the email with correct to/from/subject/html",
  async () => {
    setSmtpEnv();

    // We need to mock nodemailer. Since the module imports it at the top,
    // we intercept via a dynamic mock approach: load the module and verify
    // by checking the exported helpers, then test the actual sendMail call
    // by replacing the createTransport at the nodemailer level.
    const nodemailer = await import("nodemailer");

    let sentMail = null;
    const mockTransporter = {
      sendMail: async (mailOptions) => {
        sentMail = mailOptions;
        return { messageId: "mock-id" };
      },
    };
    const origCreateTransport = nodemailer.default.createTransport;
    nodemailer.default.createTransport = () => mockTransporter;

    try {
      const { sendLoginEmail } = await loadModule();
      await sendLoginEmail({ email: "bowler@example.com", token: "def456", query: buildMockQuery() });

      assert.ok(sentMail, "sendMail should have been called");
      assert.equal(sentMail.to, "bowler@example.com");
      assert.equal(sentMail.from, "Test <test@example.com>");
      assert.equal(sentMail.subject, "Your Golden Gate Classic login link");
      assert.ok(
        sentMail.html.includes(
          "https://www.goldengateclassic.org/api/portal/participant/verify?token=def456"
        ),
        "HTML body should contain the full verify URL with production base"
      );
      assert.ok(
        sentMail.text.includes(
          "https://www.goldengateclassic.org/api/portal/participant/verify?token=def456"
        ),
        "Text body should contain the full verify URL"
      );
    } finally {
      nodemailer.default.createTransport = origCreateTransport;
    }
  }
);

test(
  "Given SMTP send fails, when sendLoginEmail is called, then the error propagates",
  async () => {
    setSmtpEnv();

    const nodemailer = await import("nodemailer");

    const mockTransporter = {
      sendMail: async () => {
        throw new Error("SMTP connection refused");
      },
    };
    const origCreateTransport = nodemailer.default.createTransport;
    nodemailer.default.createTransport = () => mockTransporter;

    try {
      const { sendLoginEmail } = await loadModule();
      await assert.rejects(
        () => sendLoginEmail({ email: "bowler@example.com", token: "fail999", query: buildMockQuery() }),
        { message: "SMTP connection refused" }
      );
    } finally {
      nodemailer.default.createTransport = origCreateTransport;
    }
  }
);
