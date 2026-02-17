import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const API_PATH = resolve(ROOT, "src/pages/api/portal/admin/request-reset.js");

describe("Request Reset API endpoint", () => {
  it("Given the project, when checked, then request-reset.js API route exists", () => {
    assert.ok(existsSync(API_PATH), "src/pages/api/portal/admin/request-reset.js should exist");
  });

  const src = existsSync(API_PATH) ? readFileSync(API_PATH, "utf8") : "";

  it("Given request-reset handler, when checked, then only allows POST method", () => {
    assert.ok(
      src.includes('req.method !== "POST"') || src.includes("req.method !== 'POST'"),
      "Handler should check for POST method"
    );
  });

  it("Given request-reset handler, when checked, then imports ensureAdminResetTables", () => {
    assert.ok(
      src.includes("ensureAdminResetTables"),
      "Handler should use ensureAdminResetTables for table creation"
    );
  });

  it("Given request-reset handler, when checked, then queries admins table by email", () => {
    assert.ok(
      src.includes("from admins") || src.includes("FROM admins"),
      "Handler should query the admins table"
    );
  });

  it("Given request-reset handler, when checked, then generates a random token", () => {
    assert.ok(
      src.includes("crypto.randomBytes") || src.includes("randomBytes") || src.includes("generateSecureToken"),
      "Handler should generate a cryptographically random token"
    );
  });

  it("Given request-reset handler, when checked, then inserts into admin_password_resets", () => {
    assert.ok(
      src.includes("admin_password_resets"),
      "Handler should insert reset token into admin_password_resets table"
    );
  });

  it("Given request-reset handler, when checked, then calls sendPasswordResetEmail", () => {
    assert.ok(
      src.includes("sendPasswordResetEmail"),
      "Handler should send the password reset email"
    );
  });

  it("Given request-reset handler, when checked, then always returns ok true (no enumeration)", () => {
    assert.ok(
      src.includes('{ ok: true }') || src.includes("{ ok: true }"),
      "Handler should always return { ok: true } regardless of email validity"
    );
  });

  it("Given request-reset handler, when checked, then does not require authentication", () => {
    assert.ok(
      !src.includes("requireSuperAdmin(req") && !src.includes("requireAdmin(req"),
      "Handler should NOT require authentication (admin can't log in)"
    );
  });
});
