const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SSR_HELPERS_PATH = path.join(
  process.cwd(),
  "src/utils/portal/ssr-helpers.js"
);

const readSource = () => fs.readFileSync(SSR_HELPERS_PATH, "utf8");

test("Given SSR helpers, when inspecting source, then requireSessionWithVisibilitySSR validates admin session revocation", () => {
  const source = readSource();
  assert.ok(source.includes("checkSessionRevocation"), "SSR helpers should use session revocation check");
  assert.ok(
    source.includes("if (adminSession && !(await checkSessionRevocation(adminSession)))"),
    "Visibility SSR helper should reject revoked admin sessions"
  );
});

test("Given SSR admin guards, when inspecting source, then requireAdminSSR and requireSuperAdminSSR validate session revocation", () => {
  const source = readSource();
  assert.ok(
    source.includes("const requireAdminSSR = async"),
    "requireAdminSSR should be async to support revocation checks"
  );
  assert.ok(
    source.includes("const requireSuperAdminSSR = async"),
    "requireSuperAdminSSR should be async to support revocation checks"
  );
  assert.ok(
    source.includes("const isValidSession = payload ? await checkSessionRevocation(payload) : false"),
    "Admin SSR guards should verify token revocation"
  );
});
