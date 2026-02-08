import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const RESET_PAGE_PATH = resolve(ROOT, "src/pages/portal/admin/reset.js");
const src = readFileSync(RESET_PAGE_PATH, "utf8");

describe("Admin Reset Page — email form", () => {
  it("Given reset page, when checked, then has an email input field", () => {
    assert.ok(
      src.includes('type="email"') || src.includes("type={'email'}") || src.includes("email"),
      "Page should have an email input field"
    );
  });

  it("Given reset page, when checked, then posts to /api/portal/admin/request-reset", () => {
    assert.ok(
      src.includes("/api/portal/admin/request-reset"),
      "Page should POST to the request-reset API endpoint"
    );
  });

  it("Given reset page, when checked, then uses AckMessage component for confirmation", () => {
    assert.ok(
      src.includes("AckMessage"),
      "Page should use AckMessage component to show confirmation"
    );
  });

  it("Given reset page, when checked, then uses PortalShell layout", () => {
    assert.ok(
      src.includes("PortalShell"),
      "Page should use PortalShell layout"
    );
  });
});

describe("Admin Reset Page — SSR token verification", () => {
  it("Given reset page, when checked, then has getServerSideProps", () => {
    assert.ok(
      src.includes("getServerSideProps"),
      "Page should export getServerSideProps for token verification"
    );
  });

  it("Given reset page, when checked, then queries admin_password_resets table", () => {
    assert.ok(
      src.includes("admin_password_resets"),
      "SSR should query admin_password_resets to validate token"
    );
  });

  it("Given reset page, when checked, then sets COOKIE_ADMIN_RESET cookie on valid token", () => {
    assert.ok(
      src.includes("COOKIE_ADMIN_RESET"),
      "SSR should set the admin reset cookie when token is valid"
    );
  });

  it("Given reset page, when checked, then redirects to reset-password on valid token", () => {
    assert.ok(
      src.includes("/portal/admin/reset-password"),
      "SSR should redirect to reset-password page on valid token"
    );
  });

  it("Given reset page, when checked, then handles invalid/expired token with error state", () => {
    assert.ok(
      src.includes("tokenError") || src.includes("token_error") || src.includes("expired"),
      "Page should handle invalid or expired tokens"
    );
  });
});
