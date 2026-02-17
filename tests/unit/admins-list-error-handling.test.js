const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const FILE = path.join(
  process.cwd(),
  "src/pages/portal/admin/admins/index.js"
);

const src = fs.readFileSync(FILE, "utf-8");

describe("Admins list page — API error handling", () => {
  test("Given loadAdmins, when the API returns a non-ok response, then the error is surfaced to the user", () => {
    // Previously a 500 response was silently swallowed because the code
    // only checked Array.isArray(data), so a { error: "..." } response
    // just set admins to [] with no visible error message.
    assert.match(
      src,
      /response\.ok/,
      "loadAdmins must check response.ok before parsing JSON"
    );
    assert.match(
      src,
      /setError/,
      "loadAdmins must call setError when response is not ok"
    );
  });

  test("Given loadAdmins, when the API returns a non-ok response, then the HTTP status code is included in the error", () => {
    // The status code helps diagnose issues (401 = auth, 500 = server bug, etc.)
    assert.match(
      src,
      /response\.status/,
      "Error message must include the HTTP status code for debugging"
    );
  });
});

describe("Admins list page — admins-client imports", () => {
  test("Given the admins list page, when checking imports, then canRevokeAdmin is imported from admins-client", () => {
    // Previously canRevokeAdmin was missing from the main repo copy of
    // admins-client.js, causing "canRevokeAdmin is not a function" at runtime.
    assert.match(
      src,
      /import\s*\{[^}]*canRevokeAdmin[^}]*\}\s*from.*admins-client/,
      "canRevokeAdmin must be imported from admins-client.js"
    );
  });

  test("Given the admins-client module, when checking exports, then canRevokeAdmin is exported", () => {
    const clientFile = path.join(
      process.cwd(),
      "src/utils/portal/admins-client.js"
    );
    const clientSrc = fs.readFileSync(clientFile, "utf-8");
    assert.match(
      clientSrc,
      /export\s+(const|function)\s+canRevokeAdmin/,
      "canRevokeAdmin must be exported from admins-client.js"
    );
  });
});
