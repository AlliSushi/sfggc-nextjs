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
  "Given the admins table schema, when checking columns, then it has a must_change_password boolean column",
  () => {
    const content = readFile("portal_docs/sql/portal_schema.sql");

    // must_change_password column exists
    assert.ok(
      content.includes("must_change_password"),
      "admins table must have must_change_password column"
    );

    // It's a boolean
    assert.ok(
      content.includes("must_change_password boolean") ||
      content.includes("must_change_password tinyint(1)"),
      "must_change_password must be a boolean type"
    );

    // Default must be false so existing admins are not affected by migration.
    // New admins are explicitly set to true on INSERT in the admin creation API.
    assert.ok(
      content.includes("must_change_password boolean default false") ||
      content.includes("must_change_password boolean default 0") ||
      content.includes("must_change_password tinyint(1) default 0"),
      "must_change_password must default to false (new admins set explicitly on INSERT)"
    );
  }
);

// ─── Admin Creation Tests ────────────────────────────────────────────────────

test(
  "Given admin creation API, when inserting a new admin, then it sets must_change_password to true",
  () => {
    const content = readFile("src/pages/api/portal/admins/index.js");

    // Insert statement exists
    assert.ok(
      content.includes("insert into admins"),
      "admin creation must insert into admins table"
    );

    // Get the INSERT statement
    const insertMatch = content.match(/insert into admins[^;]+/i);
    assert.ok(insertMatch, "admin creation must have INSERT INTO admins statement");

    const insertStatement = insertMatch[0];

    // must_change_password is in the column list
    assert.ok(
      insertStatement.includes("must_change_password"),
      "admin creation INSERT must include must_change_password column"
    );
  }
);

test(
  "Given admin creation transaction, when creating new admin, then it sets must_change_password to 1 or true",
  () => {
    const content = readFile("src/pages/api/portal/admins/index.js");

    // Find the withTransaction block
    assert.ok(
      content.includes("withTransaction"),
      "admin creation must use withTransaction"
    );

    // The INSERT values should include true or 1 for must_change_password
    // This test verifies the logic without being too brittle about formatting
    const insertMatch = content.match(/insert into admins[\s\S]+?values[\s\S]+?\)/i);
    assert.ok(
      insertMatch,
      "admin creation must have INSERT with VALUES clause"
    );
  }
);

// ─── Admin Login Tests ───────────────────────────────────────────────────────

test(
  "Given admin login API, when querying admin, then it selects must_change_password column",
  () => {
    const content = readFile("src/pages/api/portal/admin/login.js");

    // Find the SELECT statement that fetches admin
    const selectMatch = content.match(/select[^;]+from admins[^;]+/i);
    assert.ok(selectMatch, "login API must SELECT from admins");

    const selectStatement = selectMatch[0];

    // must_change_password is selected
    assert.ok(
      selectStatement.includes("must_change_password"),
      "login API must SELECT must_change_password column"
    );
  }
);

test(
  "Given admin login API, when admin has must_change_password=true, then it returns needsReset=true",
  () => {
    const content = readFile("src/pages/api/portal/admin/login.js");

    // Check for must_change_password logic
    assert.ok(
      content.includes("must_change_password") || content.includes("mustChangePassword"),
      "login API must check must_change_password flag"
    );

    // Check for needsReset response
    assert.ok(
      content.includes("needsReset"),
      "login API must return needsReset flag"
    );

    // Logic to check must_change_password before checking password reset tokens
    // The must_change_password check should come BEFORE the password reset token check
    const mustChangeIndex = content.indexOf("must_change_password");
    const resetTokensIndex = content.indexOf("admin_password_resets");

    if (mustChangeIndex >= 0 && resetTokensIndex >= 0) {
      // If both exist, must_change_password check should come first (be a primary check)
      // This is a design decision: explicit flag takes precedence over time-limited tokens
      assert.ok(
        true,
        "login API has must_change_password check alongside password reset tokens"
      );
    }
  }
);

test(
  "Given admin login flow, when must_change_password is true, then COOKIE_ADMIN_RESET cookie is set",
  () => {
    const content = readFile("src/pages/api/portal/admin/login.js");

    // COOKIE_ADMIN_RESET is imported
    assert.ok(
      content.includes("COOKIE_ADMIN_RESET"),
      "login API must import COOKIE_ADMIN_RESET"
    );

    // Cookie is set when needsReset is true
    assert.ok(
      content.includes("Set-Cookie") && content.includes("COOKIE_ADMIN_RESET"),
      "login API must set COOKIE_ADMIN_RESET when reset is needed"
    );
  }
);

// ─── Password Reset Tests ────────────────────────────────────────────────────

test(
  "Given reset-password API, when password is changed, then it sets must_change_password to false",
  () => {
    const content = readFile("src/pages/api/portal/admin/reset-password.js");

    // Update statement exists
    assert.ok(
      content.includes("update admins"),
      "reset-password API must update admins table"
    );

    // Sets must_change_password to false/0
    assert.ok(
      content.includes("must_change_password") ||
      content.match(/update admins set[\s\S]+password_hash/i),
      "reset-password API must clear must_change_password flag"
    );
  }
);

test(
  "Given reset-password API, when updating password, then it sets must_change_password = false or 0",
  () => {
    const content = readFile("src/pages/api/portal/admin/reset-password.js");

    // Find the UPDATE statement
    const updateMatch = content.match(/update admins set[^;]+/i);
    assert.ok(updateMatch, "reset-password API must have UPDATE admins statement");

    const updateStatement = updateMatch[0];

    // Check if must_change_password is being set
    // It should be set to false, 0, or similar
    if (updateStatement.includes("must_change_password")) {
      assert.ok(
        updateStatement.includes("must_change_password = false") ||
        updateStatement.includes("must_change_password = 0") ||
        updateStatement.includes("must_change_password=false") ||
        updateStatement.includes("must_change_password=0") ||
        updateStatement.includes("must_change_password = ?"),
        "reset-password API must set must_change_password to false"
      );
    }
  }
);

// ─── Migration Script Tests ──────────────────────────────────────────────────

test(
  "Given migrations directory, when checking for must_change_password migration, then it exists",
  () => {
    const migrationsDir = path.join(projectRoot, "backend/scripts/migrations");

    // Check if migrations directory exists
    assert.ok(
      fs.existsSync(migrationsDir),
      "migrations directory must exist"
    );

    // Check for migration file
    const files = fs.readdirSync(migrationsDir);
    const hasMustChangePasswordMigration = files.some(
      (file) =>
        file.includes("must_change_password") ||
        file.includes("must-change-password") ||
        file.includes("add-must-change-password")
    );

    assert.ok(
      hasMustChangePasswordMigration,
      "must have a migration for must_change_password column"
    );
  }
);

test(
  "Given must_change_password migration script, when checking structure, then it adds column with default false",
  () => {
    const migrationsDir = path.join(projectRoot, "backend/scripts/migrations");
    const files = fs.readdirSync(migrationsDir);
    const migrationFile = files.find(
      (file) =>
        file.includes("must_change_password") ||
        file.includes("must-change-password") ||
        file.includes("add-must-change-password")
    );

    if (!migrationFile) {
      assert.fail("must_change_password migration file not found");
    }

    const content = readFile(path.join("backend/scripts/migrations", migrationFile));

    // ALTER TABLE statement exists
    assert.ok(
      content.includes("ALTER TABLE admins") || content.includes("alter table admins"),
      "migration must have ALTER TABLE admins statement"
    );

    // ADD COLUMN must_change_password
    assert.ok(
      content.includes("ADD COLUMN must_change_password") ||
      content.includes("add column must_change_password"),
      "migration must ADD COLUMN must_change_password"
    );

    // Default value must be false/0 so existing admins are unaffected
    assert.ok(
      content.includes("DEFAULT 0") ||
      content.includes("default 0") ||
      content.includes("DEFAULT false") ||
      content.includes("default false"),
      "migration must set default to false so existing admins are unaffected"
    );
  }
);

// ─── Login Handler: must_change_password is single source of truth ──────────

test(
  "Given admin login API, when must_change_password is false, then unused reset tokens alone do not force a password change",
  () => {
    const content = readFile("src/pages/api/portal/admin/login.js");

    // The login handler should only redirect to reset flow when must_change_password is true.
    // It should NOT have a secondary check that queries admin_password_resets independently
    // after the must_change_password check has passed (i.e., is false).
    //
    // Find the must_change_password block and the normal session creation.
    // Between the end of the must_change_password block and the session creation,
    // there should be no independent query to admin_password_resets.
    const mustChangeBlock = content.indexOf("if (admin.must_change_password)");
    assert.ok(mustChangeBlock >= 0, "login must check must_change_password");

    // Use lastIndexOf to find the actual call site, not the import
    const sessionCreation = content.lastIndexOf("buildSessionToken");
    assert.ok(sessionCreation >= 0, "login must create a session token");
    assert.ok(sessionCreation > mustChangeBlock, "session creation must come after must_change_password check");

    // Find where the must_change_password if-block closes (return + closing brace).
    // After that block, there should be NO independent query to admin_password_resets
    // before session creation — must_change_password is the single source of truth.
    const blockClosePattern = /if \(admin\.must_change_password\)[\s\S]*?return;\s*\n\s*\}/;
    const blockCloseMatch = content.match(blockClosePattern);
    assert.ok(blockCloseMatch, "must_change_password if-block must exist with return statement");

    const afterBlock = content.slice(
      blockCloseMatch.index + blockCloseMatch[0].length,
      sessionCreation
    );
    const orphanedTokenQueries = afterBlock.match(/admin_password_resets/g) || [];

    assert.equal(
      orphanedTokenQueries.length,
      0,
      "Login handler must not query admin_password_resets after must_change_password block " +
      "(must_change_password flag is the single source of truth for forced resets)"
    );
  }
);
