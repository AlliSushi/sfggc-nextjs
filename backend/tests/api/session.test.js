import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSessionToken, parseCookies, verifyToken, buildCookieString } from "../../../src/utils/portal/session.js";

test("Given a session token, when verifying, then payload is returned", () => {
  process.env.ADMIN_SESSION_SECRET = "test-secret";
  const token = buildSessionToken({ email: "admin@example.com", role: "super-admin" }, 1000);
  const payload = verifyToken(token);

  assert.equal(payload.email, "admin@example.com");
  assert.equal(payload.role, "super-admin");
});

test("Given an invalid token, when verifying, then null is returned", () => {
  process.env.ADMIN_SESSION_SECRET = "test-secret";
  const payload = verifyToken("invalid.token.value");
  assert.equal(payload, null);
});

test("Given a cookie header, when parsing, then cookies are returned", () => {
  const cookies = parseCookies("portal_admin=token123; other=456");
  assert.equal(cookies.portal_admin, "token123");
  assert.equal(cookies.other, "456");
});

/* ------------------------------------------------------------------ */
/*  buildCookieString - Secure cookie flag                            */
/* ------------------------------------------------------------------ */

test("Given non-production env, when building cookie string, then Secure flag is absent", () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const cookie = buildCookieString("portal_admin", "tok123", 3600);
    assert.ok(cookie.startsWith("portal_admin=tok123"));
    assert.ok(cookie.includes("HttpOnly"));
    assert.ok(cookie.includes("Path=/"));
    assert.ok(cookie.includes("SameSite=Lax"));
    assert.ok(cookie.includes("Max-Age=3600"));
    assert.ok(!cookie.includes("Secure"), "Secure flag must not appear in non-production");
  } finally {
    process.env.NODE_ENV = original;
  }
});

test("Given production env, when building cookie string, then Secure flag is present", () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const cookie = buildCookieString("portal_admin", "tok123", 3600);
    assert.ok(cookie.includes("Secure"), "Secure flag must appear in production");
    assert.ok(cookie.includes("HttpOnly"));
    assert.ok(cookie.includes("SameSite=Lax"));
    assert.ok(cookie.includes("Max-Age=3600"));
  } finally {
    process.env.NODE_ENV = original;
  }
});

test("Given a logout cookie, when building cookie string, then Max-Age is 0", () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const cookie = buildCookieString("portal_admin", "", 0);
    assert.ok(cookie.startsWith("portal_admin="));
    assert.ok(cookie.includes("Max-Age=0"));
    assert.ok(cookie.includes("HttpOnly"));
  } finally {
    process.env.NODE_ENV = original;
  }
});

test("Given any environment, when building cookie string, then parts are semicolon-separated", () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const cookie = buildCookieString("name", "value", 100);
    const parts = cookie.split("; ");
    assert.equal(parts[0], "name=value");
    assert.ok(parts.includes("HttpOnly"));
    assert.ok(parts.includes("Path=/"));
    assert.ok(parts.includes("SameSite=Lax"));
    assert.ok(parts.includes("Max-Age=100"));
  } finally {
    process.env.NODE_ENV = original;
  }
});

test("Given production environment, when building cookie string, then Secure is the last part", () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const cookie = buildCookieString("name", "value", 100);
    const parts = cookie.split("; ");
    assert.equal(parts[parts.length - 1], "Secure");
  } finally {
    process.env.NODE_ENV = original;
  }
});
