const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ensureFileExists = (relativePath) => {
  const filePath = path.join(process.cwd(), relativePath);
  assert.ok(fs.existsSync(filePath), `Missing ${relativePath}`);
};

test("Given the portal MVP, when checking routes, then key pages exist", () => {
  ensureFileExists("src/pages/portal/index.js");
  ensureFileExists("src/pages/portal/admin/index.js");
  ensureFileExists("src/pages/portal/admin/dashboard.js");
  ensureFileExists("src/pages/portal/admin/participants/[pid].js");
  ensureFileExists("src/pages/api/portal/participants/index.js");
  ensureFileExists("src/pages/portal/participant/index.js");
  ensureFileExists("src/pages/api/portal/participants/[pid].js");
  ensureFileExists("src/pages/api/portal/participants/[pid]/audit.js");
  ensureFileExists("src/pages/api/portal/admin/import-xml.js");
  ensureFileExists("src/pages/api/portal/admin/audit.js");
  ensureFileExists("src/pages/api/portal/admin/audit/clear.js");
  ensureFileExists("src/pages/portal/admin/admins/index.js");
  ensureFileExists("src/pages/portal/team/[teamSlug].js");
  ensureFileExists("src/pages/api/portal/teams/[teamSlug].js");
  ensureFileExists("src/pages/api/portal/admin/refresh.js");
  ensureFileExists("src/pages/portal/admin/audit.js");
  ensureFileExists("src/pages/api/portal/participant/login.js");
  ensureFileExists("src/pages/api/portal/participant/verify.js");
  ensureFileExists("src/pages/api/portal/participant/session.js");
  ensureFileExists("src/pages/api/portal/participant/logout.js");
  ensureFileExists("src/pages/portal/participant/verify.js");
  ensureFileExists("src/pages/api/portal/admin/logout.js");
  ensureFileExists("src/pages/api/portal/admins/index.js");
  ensureFileExists("src/pages/api/portal/admins/lookup.js");
  ensureFileExists("src/pages/api/portal/admins/[id]/index.js");
  ensureFileExists("src/pages/api/portal/admin/reset-password.js");
  ensureFileExists("src/pages/portal/admin/reset-password.js");
});
