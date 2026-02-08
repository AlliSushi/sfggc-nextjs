import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const API_PATH = resolve(
  ROOT,
  "src/pages/api/portal/admin/reset-password.js"
);
const PAGE_PATH = resolve(ROOT, "src/pages/portal/admin/reset-password.js");

const apiSrc = readFileSync(API_PATH, "utf8");
const pageSrc = readFileSync(PAGE_PATH, "utf8");

describe("Reset Password API — no auto-login after reset", () => {
  it("Given reset-password API, when checked, then it does NOT import ADMIN_SESSION_TTL_MS", () => {
    assert.ok(
      !apiSrc.includes("ADMIN_SESSION_TTL_MS"),
      "API should not import ADMIN_SESSION_TTL_MS — no session should be created after reset"
    );
  });

  it("Given reset-password API, when checked, then it does NOT import buildSessionToken", () => {
    assert.ok(
      !apiSrc.includes("buildSessionToken"),
      "API should not import buildSessionToken — user must log in manually after reset"
    );
  });

  it("Given reset-password API, when checked, then it does NOT import COOKIE_ADMIN session constant", () => {
    const hasBareImport = /\bCOOKIE_ADMIN\b(?!_RESET)/.test(apiSrc);
    assert.ok(
      !hasBareImport,
      "API should not reference COOKIE_ADMIN — no admin session cookie should be set"
    );
  });

  it("Given reset-password API, when checked, then it only clears the reset cookie", () => {
    assert.ok(
      apiSrc.includes("COOKIE_ADMIN_RESET"),
      "API should still clear the COOKIE_ADMIN_RESET cookie"
    );
  });
});

describe("Reset Password API — invalidates all tokens for admin", () => {
  it("Given reset-password API, when checked, then it invalidates all unused tokens by admin_id", () => {
    assert.ok(
      apiSrc.includes("where admin_id = ?") ||
        apiSrc.includes("WHERE admin_id = ?"),
      "API should invalidate tokens by admin_id, not by individual reset id"
    );
    assert.ok(
      apiSrc.includes("used_at is null") ||
        apiSrc.includes("used_at IS NULL"),
      "API should target only unused tokens (used_at IS NULL)"
    );
  });

  it("Given reset-password API, when checked, then it does NOT invalidate by single reset id only", () => {
    const markUsedStatements = apiSrc.match(
      /update\s+admin_password_resets\s+set\s+used_at/gi
    );
    assert.ok(markUsedStatements, "API should have an UPDATE statement for used_at");
    const usesWhereId = /update\s+admin_password_resets\s+set\s+used_at\s*=\s*now\(\)\s+where\s+id\s*=/i.test(apiSrc);
    assert.ok(
      !usesWhereId,
      "API should NOT use WHERE id = ? — must invalidate ALL tokens for the admin, not just the one used"
    );
  });
});

describe("Reset Password API — specific validation error messages", () => {
  it("Given reset-password API, when checked, then it uses validatePassword that returns specific errors", () => {
    assert.ok(
      apiSrc.includes("validatePassword"),
      "API should use a validatePassword function"
    );
    assert.ok(
      !apiSrc.includes("isStrongPassword"),
      "API should NOT use a boolean isStrongPassword — must return specific error messages"
    );
  });

  it("Given reset-password API, when checked, then validatePassword returns a message for short passwords", () => {
    const validatorsSrc = readFileSync(
      resolve(ROOT, "src/utils/portal/validators.js"),
      "utf8"
    );
    assert.ok(
      (apiSrc.includes("at least") && apiSrc.includes("characters")) ||
      (validatorsSrc.includes("at least") && validatorsSrc.includes("characters")),
      "validatePassword should return a specific message about minimum character length"
    );
  });

  it("Given reset-password API, when checked, then validatePassword returns a message for missing lowercase", () => {
    const validatorsSrc = readFileSync(
      resolve(ROOT, "src/utils/portal/validators.js"),
      "utf8"
    );
    assert.ok(
      apiSrc.includes("lowercase") || validatorsSrc.includes("lowercase"),
      "validatePassword should return a specific message about needing a lowercase letter"
    );
  });

  it("Given reset-password API, when checked, then validatePassword returns a message for missing uppercase", () => {
    const validatorsSrc = readFileSync(
      resolve(ROOT, "src/utils/portal/validators.js"),
      "utf8"
    );
    assert.ok(
      apiSrc.includes("uppercase") || validatorsSrc.includes("uppercase"),
      "validatePassword should return a specific message about needing an uppercase letter"
    );
  });

  it("Given reset-password API, when checked, then validatePassword returns a message for missing number", () => {
    const validatorsSrc = readFileSync(
      resolve(ROOT, "src/utils/portal/validators.js"),
      "utf8"
    );
    assert.ok(
      apiSrc.includes("one number") || validatorsSrc.includes("one number"),
      "validatePassword should return a specific message about needing a number"
    );
  });
});

describe("Reset Password Page — redirects to login, not dashboard", () => {
  it("Given reset-password page, when checked, then it does NOT redirect to dashboard", () => {
    assert.ok(
      !pageSrc.includes("/portal/admin/dashboard"),
      "Page should not redirect to dashboard — user must log in manually"
    );
  });

  it("Given reset-password page, when checked, then it uses router to redirect to login on success", () => {
    assert.ok(
      pageSrc.includes("useRouter") && pageSrc.includes("router.push"),
      "Page should use Next.js router to redirect after successful reset"
    );
    assert.ok(
      pageSrc.includes('"/portal/admin/"') || pageSrc.includes("'/portal/admin/'"),
      "Page should redirect to the admin login page"
    );
  });

  it("Given reset-password page, when checked, then it does NOT use an intermediate success screen", () => {
    assert.ok(
      !pageSrc.includes("AckMessage"),
      "Page should redirect directly to login — no intermediate success screen"
    );
  });
});

describe("Reset Password Page — SSR guard against stale access", () => {
  it("Given reset-password page, when checked, then it has getServerSideProps", () => {
    assert.ok(
      pageSrc.includes("getServerSideProps"),
      "Page must use getServerSideProps to guard against access without a valid reset cookie"
    );
  });

  it("Given reset-password page, when checked, then SSR reads the reset cookie", () => {
    assert.ok(
      pageSrc.includes("COOKIE_ADMIN_RESET"),
      "SSR should check for the COOKIE_ADMIN_RESET cookie"
    );
  });

  it("Given reset-password page, when checked, then SSR validates the token against the database", () => {
    assert.ok(
      pageSrc.includes("admin_password_resets"),
      "SSR should query admin_password_resets to validate the token is still usable"
    );
  });

  it("Given reset-password page, when checked, then SSR redirects to login if token is missing or invalid", () => {
    assert.ok(
      pageSrc.includes("redirect") && pageSrc.includes("/portal/admin"),
      "SSR should redirect to login page when reset cookie is missing or token is invalid"
    );
  });
});
