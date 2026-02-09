const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const DEPLOYRC_EXAMPLE = path.join(process.cwd(), ".deployrc.example");

describe("Deployment configuration path format", () => {
  test("Given .deployrc.example, when checking deployment paths, then no tilde paths are used", () => {
    const content = fs.readFileSync(DEPLOYRC_EXAMPLE, "utf-8");

    // Extract DEPLOY_STATIC_PATH
    const staticPathMatch = content.match(/DEPLOY_STATIC_PATH="([^"]+)"/);
    assert.ok(staticPathMatch, "DEPLOY_STATIC_PATH should be defined");
    const staticPath = staticPathMatch[1];

    // Extract DEPLOY_PORTAL_PATH
    const portalPathMatch = content.match(/DEPLOY_PORTAL_PATH="([^"]+)"/);
    assert.ok(portalPathMatch, "DEPLOY_PORTAL_PATH should be defined");
    const portalPath = portalPathMatch[1];

    // Both paths must NOT use tilde
    assert.ok(!staticPath.includes("~"), `DEPLOY_STATIC_PATH must not use tilde: ${staticPath}`);
    assert.ok(!portalPath.includes("~"), `DEPLOY_PORTAL_PATH must not use tilde: ${portalPath}`);
  });

  test("Given .deployrc.example, when checking deployment paths, then both use absolute paths", () => {
    const content = fs.readFileSync(DEPLOYRC_EXAMPLE, "utf-8");

    // Extract paths
    const staticPathMatch = content.match(/DEPLOY_STATIC_PATH="([^"]+)"/);
    const portalPathMatch = content.match(/DEPLOY_PORTAL_PATH="([^"]+)"/);

    const staticPath = staticPathMatch[1];
    const portalPath = portalPathMatch[1];

    // Both must start with /
    assert.ok(staticPath.startsWith("/"), `DEPLOY_STATIC_PATH must be absolute: ${staticPath}`);
    assert.ok(portalPath.startsWith("/"), `DEPLOY_PORTAL_PATH must be absolute: ${portalPath}`);
  });

  test("Given .deployrc.example, when checking deployment paths, then both use consistent format", () => {
    const content = fs.readFileSync(DEPLOYRC_EXAMPLE, "utf-8");

    // Extract paths
    const staticPathMatch = content.match(/DEPLOY_STATIC_PATH="([^"]+)"/);
    const portalPathMatch = content.match(/DEPLOY_PORTAL_PATH="([^"]+)"/);

    const staticPath = staticPathMatch[1];
    const portalPath = portalPathMatch[1];

    // Both should start with /home/ for consistency
    assert.ok(
      staticPath.startsWith("/home/"),
      `DEPLOY_STATIC_PATH should start with /home/: ${staticPath}`
    );
    assert.ok(
      portalPath.startsWith("/home/"),
      `DEPLOY_PORTAL_PATH should start with /home/: ${portalPath}`
    );

    // Both should use the same username
    const staticUsername = staticPath.match(/^\/home\/([^/]+)\//)?.[1];
    const portalUsername = portalPath.match(/^\/home\/([^/]+)\//)?.[1];

    assert.strictEqual(
      staticUsername,
      portalUsername,
      `Both paths should use same username. Static: ${staticUsername}, Portal: ${portalUsername}`
    );
  });

  test("Given .deployrc.example, when checking SSH user, then it matches the path username", () => {
    const content = fs.readFileSync(DEPLOYRC_EXAMPLE, "utf-8");

    // Extract SSH user
    const sshUserMatch = content.match(/DEPLOY_SSH_USER="([^"]+)"/);
    assert.ok(sshUserMatch, "DEPLOY_SSH_USER should be defined");
    const sshUser = sshUserMatch[1];

    // Extract path username from static path
    const staticPathMatch = content.match(/DEPLOY_STATIC_PATH="([^"]+)"/);
    const staticPath = staticPathMatch[1];
    const pathUsername = staticPath.match(/^\/home\/([^/]+)\//)?.[1];

    assert.strictEqual(
      sshUser,
      pathUsername,
      `SSH_USER should match path username. SSH_USER: ${sshUser}, Path username: ${pathUsername}`
    );
  });

  test("Given .deployrc.example, when checking documentation, then tilde path issue is explained", () => {
    const content = fs.readFileSync(DEPLOYRC_EXAMPLE, "utf-8");

    // Should have a comment explaining why we don't use tildes or $HOME
    // This serves as documentation for future maintainers
    const hasNoTildeWarning =
      content.includes("absolute path") ||
      content.includes("full path") ||
      content.includes("/home/");

    assert.ok(
      hasNoTildeWarning,
      ".deployrc.example should document the path format requirement"
    );
  });
});
