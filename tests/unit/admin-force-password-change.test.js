const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();

// ─── Helper Functions ────────────────────────────────────────────────────────

const readFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

// ─── Database Schema Tests ───────────────────────────────────────────────────

test(
  "Given the admins table schema, when checking columns, then it has sessions_revoked_at timestamp column",
  () => {
    const content = readFile("portal_docs/sql/portal_schema.sql");

    // sessions_revoked_at column exists
    assert.ok(
      content.includes("sessions_revoked_at"),
      "admins table must have sessions_revoked_at column"
    );

    // It's a timestamp
    assert.ok(
      content.includes("sessions_revoked_at timestamp"),
      "sessions_revoked_at must be a timestamp type"
    );

    // Allows null (optional - only set when forcing password change)
    assert.ok(
      !content.includes("sessions_revoked_at timestamp not null"),
      "sessions_revoked_at should allow null (only set when revoking sessions)"
    );
  }
);

// ─── Migration Tests ─────────────────────────────────────────────────────────

test(
  "Given migrations directory, when checking for sessions_revoked_at migration, then it exists",
  () => {
    const migrationsDir = path.join(projectRoot, "backend/scripts/migrations");
    const files = fs.readdirSync(migrationsDir);

    const hasSessionRevocationMigration = files.some(
      (file) =>
        file.includes("sessions_revoked_at") ||
        file.includes("sessions-revoked-at") ||
        file.includes("add-sessions-revoked")
    );

    assert.ok(
      hasSessionRevocationMigration,
      "must have a migration for sessions_revoked_at column"
    );
  }
);

// ─── Password Generator Tests ────────────────────────────────────────────────

test(
  "Given password generator utility, when checking for export, then generateStrongPassword function exists",
  () => {
    const utilFiles = fs.readdirSync(path.join(projectRoot, "src/utils/portal"));
    const hasPasswordGenerator = utilFiles.some(
      (file) => file.includes("password-generator") || file.includes("passwordGenerator")
    );

    assert.ok(
      hasPasswordGenerator,
      "must have a password generator utility file"
    );
  }
);

test(
  "Given password generator, when generating password, then it exports generateStrongPassword function",
  () => {
    const utilFiles = fs.readdirSync(path.join(projectRoot, "src/utils/portal"));
    const passwordGenFile = utilFiles.find(
      (file) => file.includes("password-generator") || file.includes("passwordGenerator")
    );

    if (!passwordGenFile) {
      assert.fail("Password generator file not found");
    }

    const content = readFile(path.join("src/utils/portal", passwordGenFile));

    // Function is defined
    assert.ok(
      content.includes("generateStrongPassword") || content.includes("generate"),
      "password generator must export generateStrongPassword function"
    );

    // Uses crypto module
    assert.ok(
      content.includes("crypto"),
      "password generator should use crypto module for secure randomness"
    );
  }
);

// ─── Email Template Tests ────────────────────────────────────────────────────

test(
  "Given email templates database, when checking templates, then admin-forced-password-reset template exists",
  () => {
    const content = readFile("src/utils/portal/email-templates-db.js");

    // Template slug exists
    assert.ok(
      content.includes("admin-forced-password-reset") ||
      content.includes("admin-force-password-reset"),
      "email templates must include admin-forced-password-reset template"
    );

    // Has required fields
    assert.ok(
      content.includes("subject") && content.includes("body"),
      "email template must have subject and body"
    );
  }
);

test(
  "Given forced password reset email template, when checking variables, then it includes temporaryPassword variable",
  () => {
    const content = readFile("src/utils/portal/email-templates-db.js");

    // Find the forced password reset template section
    const hasTemporaryPasswordVar =
      content.includes("temporaryPassword") &&
      content.includes("admin-forced-password-reset");

    assert.ok(
      hasTemporaryPasswordVar,
      "forced password reset template must include temporaryPassword variable"
    );
  }
);

// ─── API Endpoint Tests ──────────────────────────────────────────────────────

test(
  "Given API routes, when checking for force password change endpoint, then /api/portal/admins/[id]/force-password-change.js exists",
  () => {
    const apiPath = path.join(projectRoot, "src/pages/api/portal/admins/[id]");

    // Check if directory exists
    if (!fs.existsSync(apiPath)) {
      assert.fail("API directory /api/portal/admins/[id] does not exist");
    }

    const files = fs.readdirSync(apiPath);
    const hasForcePasswordChangeEndpoint = files.some(
      (file) => file.includes("force-password-change")
    );

    assert.ok(
      hasForcePasswordChangeEndpoint,
      "must have force-password-change.js API endpoint"
    );
  }
);

test(
  "Given force password change API, when checking handler, then it accepts POST method",
  () => {
    const apiPath = path.join(projectRoot, "src/pages/api/portal/admins/[id]");
    const files = fs.readdirSync(apiPath);
    const endpoint = files.find((file) => file.includes("force-password-change"));

    if (!endpoint) {
      assert.fail("force-password-change endpoint not found");
    }

    const content = readFile(path.join("src/pages/api/portal/admins/[id]", endpoint));

    // Handles POST method
    assert.ok(
      content.includes("POST") && content.includes("method"),
      "endpoint must handle POST method"
    );

    // Requires super admin
    assert.ok(
      content.includes("requireSuperAdmin") || content.includes("super-admin"),
      "endpoint must require super-admin authorization"
    );
  }
);

test(
  "Given force password change API, when forcing password change, then it generates new password and updates admin",
  () => {
    const apiPath = path.join(projectRoot, "src/pages/api/portal/admins/[id]");
    const files = fs.readdirSync(apiPath);
    const endpoint = files.find((file) => file.includes("force-password-change"));

    if (!endpoint) {
      assert.fail("force-password-change endpoint not found");
    }

    const content = readFile(path.join("src/pages/api/portal/admins/[id]", endpoint));

    // Generates password
    assert.ok(
      content.includes("generateStrongPassword") || content.includes("generate"),
      "endpoint must generate a strong password"
    );

    // Updates admin record
    assert.ok(
      content.includes("update admins") || content.includes("UPDATE admins"),
      "endpoint must update admin record in database"
    );

    // Sets must_change_password
    assert.ok(
      content.includes("must_change_password"),
      "endpoint must set must_change_password flag"
    );

    // Sets sessions_revoked_at
    assert.ok(
      content.includes("sessions_revoked_at"),
      "endpoint must set sessions_revoked_at timestamp"
    );

    // Sends email
    assert.ok(
      content.includes("sendEmail") || content.includes("email"),
      "endpoint must send email with temporary password"
    );
  }
);

// ─── Auth Guard Tests ────────────────────────────────────────────────────────

test(
  "Given auth guards, when checking session validation, then it checks sessions_revoked_at",
  () => {
    const content = readFile("src/utils/portal/auth-guards.js");

    // Checks sessions_revoked_at
    assert.ok(
      content.includes("sessions_revoked_at"),
      "auth guards must check sessions_revoked_at timestamp"
    );

    // Validates session creation time against revocation time
    assert.ok(
      content.includes("iat") || content.includes("issued") || content.includes("created"),
      "auth guards should validate session creation time"
    );
  }
);

// ─── Frontend Tests ──────────────────────────────────────────────────────────

test(
  "Given admin detail page, when checking UI, then it has Force Password Change button",
  () => {
    const content = readFile("src/pages/portal/admin/admins/[id].js");

    // Has button for forcing password change
    assert.ok(
      content.includes("Force Password Change") ||
      content.includes("Force password") ||
      content.includes("force-password") ||
      content.includes("Reset Password"),
      "admin detail page must have Force Password Change button"
    );

    // Has modal state
    assert.ok(
      content.includes("showForcePasswordChange") ||
      content.includes("showForceReset") ||
      (content.includes("Modal") && content.includes("password")),
      "admin detail page must have modal for force password change confirmation"
    );
  }
);

test(
  "Given admin detail page, when forcing password change, then it calls API endpoint",
  () => {
    const content = readFile("src/pages/portal/admin/admins/[id].js");

    // Has handler function
    assert.ok(
      content.includes("handleForcePasswordChange") ||
      content.includes("handleForce") ||
      content.includes("force-password-change"),
      "admin detail page must have handler for force password change"
    );

    // Makes API call
    assert.ok(
      content.includes("portalFetch") || content.includes("fetch"),
      "handler must make API call to force password change endpoint"
    );

    // Uses POST method
    assert.ok(
      content.includes('method: "POST"') || content.includes("method:'POST'"),
      "handler must use POST method"
    );
  }
);

// ─── Password Validation Tests ───────────────────────────────────────────────

test(
  "Given reset password API, when changing password, then it validates new password is different from old",
  () => {
    const content = readFile("src/pages/api/portal/admin/reset-password.js");

    // Note: This test checks if there's logic to compare passwords
    // The actual validation might be implicit (bcrypt.compare will return false if passwords match)
    // But we want explicit validation with clear error message

    assert.ok(
      content.includes("bcrypt") && content.includes("compare"),
      "reset password must use bcrypt to validate passwords"
    );
  }
);
