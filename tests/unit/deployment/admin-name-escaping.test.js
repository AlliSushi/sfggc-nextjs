const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const DEPLOY_PORTAL_SH = path.join(
  process.cwd(),
  "deploy_scripts/lib/deploy-portal.sh"
);

describe("Admin name escaping in deployment", () => {
  test("Given create_super_admin function, when passing ADMIN_NAME to remote script, then it properly escapes the value to handle spaces and special characters", () => {
    const content = fs.readFileSync(DEPLOY_PORTAL_SH, "utf-8");

    // Should prompt for admin name
    assert.ok(
      content.includes("Admin full name"),
      "create_super_admin must prompt for admin full name"
    );

    // Should escape ADMIN_NAME before passing to SSH
    // Look for printf %q or equivalent escaping mechanism
    const createAdminFunc = content.match(/create_super_admin\(\) \{[\s\S]*?^}/m);
    assert.ok(createAdminFunc, "create_super_admin function must exist");

    const funcBody = createAdminFunc[0];

    // Should use printf %q to escape shell special characters and spaces
    assert.ok(
      funcBody.includes("printf '%q'") || funcBody.includes('printf "%q"'),
      "create_super_admin must use printf %q to escape ADMIN_NAME for safe shell passing"
    );

    // Should assign escaped value to a variable before using it
    assert.ok(
      funcBody.match(/ESCAPED.*ADMIN_NAME/i) || funcBody.match(/ADMIN_NAME.*printf.*%q/),
      "create_super_admin must escape ADMIN_NAME value before passing to SSH command"
    );
  });

  test("Given create_super_admin function, when building SSH command, then ADMIN_EMAIL and ADMIN_PASSWORD are also properly escaped", () => {
    const content = fs.readFileSync(DEPLOY_PORTAL_SH, "utf-8");

    const createAdminFunc = content.match(/create_super_admin\(\) \{[\s\S]*?^}/m);
    assert.ok(createAdminFunc, "create_super_admin function must exist");

    const funcBody = createAdminFunc[0];

    // All three credentials should be escaped
    const escapedVars = funcBody.match(/printf '%q'/g) || funcBody.match(/printf "%q"/g);
    assert.ok(
      escapedVars && escapedVars.length >= 3,
      "create_super_admin must escape all three credential variables (email, name, password)"
    );
  });

  test("Given create_super_admin function, when checking ssh_command invocation, then escaped variables are used", () => {
    const content = fs.readFileSync(DEPLOY_PORTAL_SH, "utf-8");

    // Find the ssh_command call that invokes create-super-admin.sh
    const sshCommandMatch = content.match(/ssh_command "cd.*create-super-admin\.sh[^"]*"/s);
    assert.ok(sshCommandMatch, "create_super_admin must call ssh_command with create-super-admin.sh");

    const sshCommand = sshCommandMatch[0];

    // Should use ESCAPED_ variables in the ssh_command
    assert.ok(
      sshCommand.includes("ESCAPED_EMAIL") &&
      sshCommand.includes("ESCAPED_NAME") &&
      sshCommand.includes("ESCAPED_PASSWORD"),
      "ssh_command must use ESCAPED_EMAIL, ESCAPED_NAME, and ESCAPED_PASSWORD variables"
    );
  });

  test("Given create-super-admin.sh script, when checking ADMIN_NAME fallback, then it explains why email prefix is used as default", () => {
    const CREATE_SUPER_ADMIN_SH = path.join(
      process.cwd(),
      "backend/scripts/admin/create-super-admin.sh"
    );

    const content = fs.readFileSync(CREATE_SUPER_ADMIN_SH, "utf-8");

    // Find the fallback logic
    assert.ok(
      content.includes('ADMIN_NAME="${ADMIN_EMAIL%@*}"'),
      "create-super-admin.sh should have fallback to email prefix"
    );

    // Should have a comment explaining this is a fallback for when name is not provided
    const fallbackSection = content.match(/if.*ADMIN_NAME[\s\S]{0,200}ADMIN_EMAIL%@/);
    assert.ok(fallbackSection, "create-super-admin.sh should check if ADMIN_NAME is empty");

    // The comment should explain why this fallback exists
    const beforeFallback = content.substring(0, content.indexOf('ADMIN_NAME="${ADMIN_EMAIL%@*}"'));
    assert.ok(
      beforeFallback.includes("#") || beforeFallback.includes("if"),
      "create-super-admin.sh should have context around ADMIN_NAME fallback"
    );
  });
});
