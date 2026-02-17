const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = process.cwd();

// ─── Helper Functions ────────────────────────────────────────────────────────

const readFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

// ─── Error Handling and Rollback Tests ──────────────────────────────────────

test(
  "Given build_static function, when build fails, then it restores config and exits with status 1",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // Get build_static function
    const buildStaticMatch = content.match(
      /build_static\(\) \{[\s\S]*?^}/m
    );
    assert.ok(buildStaticMatch, "build_static must exist");

    const funcBody = buildStaticMatch[0];

    // Checks npm run build exit status
    assert.ok(
      funcBody.includes("if npm run build; then"),
      "build_static must check npm run build exit status"
    );

    // Has else branch for failure
    assert.ok(
      funcBody.includes("else") && funcBody.includes('log_error "Build failed"'),
      "build_static must have error handling for build failure"
    );

    // Restores config on error
    const lines = funcBody.split("\n");
    let inErrorBranch = false;
    let hasRestoreInError = false;
    let hasExitInError = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('log_error "Build failed"')) {
        inErrorBranch = true;
      }
      if (inErrorBranch) {
        if (lines[i].includes("restore_next_config")) {
          hasRestoreInError = true;
        }
        if (lines[i].includes("exit 1")) {
          hasExitInError = true;
          break;
        }
      }
    }

    assert.ok(
      hasRestoreInError,
      "build_static must restore config on build failure"
    );

    assert.ok(
      hasExitInError,
      "build_static must exit with status 1 on build failure"
    );
  }
);

test(
  "Given build_static function, when any error occurs, then trap ensures config restoration",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // Get build_static function
    const buildStaticMatch = content.match(
      /build_static\(\) \{[\s\S]*?^}/m
    );
    assert.ok(buildStaticMatch, "build_static must exist");

    const funcBody = buildStaticMatch[0];

    // Sets trap for EXIT
    assert.ok(
      funcBody.includes("trap restore_next_config EXIT"),
      "build_static must set trap to restore config on ANY exit"
    );

    // Trap is set early (before configure)
    const lines = funcBody.split("\n");
    let trapIndex = -1;
    let configureIndex = -1;

    lines.forEach((line, idx) => {
      if (line.includes("trap restore_next_config EXIT")) trapIndex = idx;
      if (line.includes("configure_static_build")) configureIndex = idx;
    });

    assert.ok(
      trapIndex >= 0 && configureIndex >= 0 && trapIndex < configureIndex,
      "trap must be set before configure_static_build is called"
    );
  }
);

test(
  "Given validate_out_directory function, when out/ is missing, then it returns 1",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // Get validate_out_directory function
    const validateMatch = content.match(
      /validate_out_directory\(\) \{[\s\S]*?^}/m
    );
    assert.ok(validateMatch, "validate_out_directory must exist");

    const funcBody = validateMatch[0];

    // Checks if out/ exists
    assert.ok(
      funcBody.includes('[ ! -d "out" ]'),
      "validate_out_directory must check if out/ directory exists"
    );

    // Logs error if missing
    assert.ok(
      funcBody.includes('log_error "Build output directory') &&
      funcBody.includes("not found"),
      "validate_out_directory must log error if out/ not found"
    );

    // Returns 1
    assert.ok(
      funcBody.includes("return 1"),
      "validate_out_directory must return 1 on failure"
    );
  }
);

test(
  "Given validate_out_directory function, when out/ is empty, then it returns 1",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    const validateMatch = content.match(
      /validate_out_directory\(\) \{[\s\S]*?^}/m
    );
    assert.ok(validateMatch, "validate_out_directory must exist");

    const funcBody = validateMatch[0];

    // Checks file count
    assert.ok(
      funcBody.includes("find out -type f"),
      "validate_out_directory must count files"
    );

    // Checks if empty
    assert.ok(
      funcBody.includes('[ "$file_count" -eq 0 ]'),
      "validate_out_directory must check if directory is empty"
    );

    // Logs error
    assert.ok(
      funcBody.includes('log_error "Build output directory is empty"'),
      "validate_out_directory must log error if empty"
    );

    // Returns 1
    const lines = funcBody.split("\n");
    let afterEmptyCheck = false;
    let hasReturn1 = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('[ "$file_count" -eq 0 ]')) {
        afterEmptyCheck = true;
      }
      if (afterEmptyCheck && lines[i].includes("return 1")) {
        hasReturn1 = true;
        break;
      }
    }

    assert.ok(
      hasReturn1,
      "validate_out_directory must return 1 when directory is empty"
    );
  }
);

test(
  "Given deploy_static function, when sync_static_files fails, then deployment stops and returns 1",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Get deploy_static function
    const deployStaticMatch = content.match(
      /deploy_static\(\) \{[\s\S]*?^}/m
    );
    assert.ok(deployStaticMatch, "deploy_static must exist");

    const funcBody = deployStaticMatch[0];

    // Checks sync_static_files exit status
    assert.ok(
      funcBody.includes("sync_static_files || {"),
      "deploy_static must check sync_static_files exit status"
    );

    // Logs error on failure
    assert.ok(
      funcBody.includes('log_error "Static deployment failed"') ||
      funcBody.includes('log_error "File sync failed"'),
      "deploy_static must log error on sync failure"
    );

    // Returns 1
    assert.ok(
      funcBody.includes("return 1"),
      "deploy_static must return 1 on sync failure"
    );
  }
);

test(
  "Given deploy_static function, when verify_static_deployment fails, then it returns 1",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    const deployStaticMatch = content.match(
      /deploy_static\(\) \{[\s\S]*?^}/m
    );
    assert.ok(deployStaticMatch, "deploy_static must exist");

    const funcBody = deployStaticMatch[0];

    // Checks verify_static_deployment exit status
    assert.ok(
      funcBody.includes("verify_static_deployment || {") ||
      (funcBody.includes("verify_static_deployment") && funcBody.includes("return 1")),
      "deploy_static must check verify_static_deployment exit status"
    );

    // Logs error on verification failure
    assert.ok(
      funcBody.includes('log_error "Verification failed"') ||
      funcBody.includes('log_error "Deployment verification failed"'),
      "deploy_static must log error on verification failure"
    );
  }
);

test(
  "Given verify_static_deployment function, when index.html is missing, then it returns 1",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Get verify_static_deployment function
    const verifyMatch = content.match(
      /verify_static_deployment\(\) \{[\s\S]*?^}/m
    );
    assert.ok(verifyMatch, "verify_static_deployment must exist");

    const funcBody = verifyMatch[0];

    // Checks for index.html
    assert.ok(
      funcBody.includes("[ -f") && funcBody.includes("index.html"),
      "verify_static_deployment must check for index.html"
    );

    // Logs error if not found
    assert.ok(
      funcBody.includes('log_error "Deployment verification failed"') ||
      funcBody.includes("index.html not found"),
      "verify_static_deployment must log error if index.html not found"
    );

    // Returns 1
    assert.ok(
      funcBody.includes("return 1"),
      "verify_static_deployment must return 1 if verification fails"
    );
  }
);

test(
  "Given deploy_portal function, when sync_portal_files fails, then deployment stops and returns 1",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-portal.sh");

    // Get deploy_portal function
    const deployPortalMatch = content.match(
      /deploy_portal\(\) \{[\s\S]*?^}/m
    );
    assert.ok(deployPortalMatch, "deploy_portal must exist");

    const funcBody = deployPortalMatch[0];

    // Checks sync_portal_files exit status
    assert.ok(
      funcBody.includes("sync_portal_files || {"),
      "deploy_portal must check sync_portal_files exit status"
    );

    // Logs specific error
    assert.ok(
      funcBody.includes('log_error "Portal deployment failed at file sync"'),
      "deploy_portal must log specific error for sync failure"
    );

    // Returns 1
    assert.ok(
      funcBody.includes("return 1"),
      "deploy_portal must return 1 on sync failure"
    );
  }
);

test(
  "Given deploy_portal function, when install_portal_dependencies fails, then deployment stops with error",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-portal.sh");

    const deployPortalMatch = content.match(
      /deploy_portal\(\) \{[\s\S]*?^}/m
    );
    assert.ok(deployPortalMatch, "deploy_portal must exist");

    const funcBody = deployPortalMatch[0];

    // Checks install_portal_dependencies exit status
    assert.ok(
      funcBody.includes("install_portal_dependencies || {"),
      "deploy_portal must check install_portal_dependencies exit status"
    );

    // Logs specific error
    assert.ok(
      funcBody.includes('log_error "Portal deployment failed at dependency installation"'),
      "deploy_portal must log specific error for dependency installation failure"
    );

    // Returns 1
    const lines = funcBody.split("\n");
    let afterInstallCheck = false;
    let hasReturn1 = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("install_portal_dependencies || {")) {
        afterInstallCheck = true;
      }
      if (afterInstallCheck && lines[i].includes("return 1")) {
        hasReturn1 = true;
        break;
      }
      if (lines[i].includes("}")) {
        afterInstallCheck = false;
      }
    }

    assert.ok(
      hasReturn1,
      "deploy_portal must return 1 on dependency installation failure"
    );
  }
);

test(
  "Given deploy_portal function, when build_portal_on_server fails, then deployment stops with error",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-portal.sh");

    const deployPortalMatch = content.match(
      /deploy_portal\(\) \{[\s\S]*?^}/m
    );
    assert.ok(deployPortalMatch, "deploy_portal must exist");

    const funcBody = deployPortalMatch[0];

    // Checks build_portal_on_server exit status
    assert.ok(
      funcBody.includes("build_portal_on_server || {"),
      "deploy_portal must check build_portal_on_server exit status"
    );

    // Logs specific error
    assert.ok(
      funcBody.includes('log_error "Portal deployment failed at build"'),
      "deploy_portal must log specific error for build failure"
    );

    // Returns 1
    assert.ok(
      funcBody.includes("return 1"),
      "deploy_portal must return 1 on build failure"
    );
  }
);

test(
  "Given build_portal_on_server function, when npm run build fails, then it logs error and returns 1",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-portal.sh");

    // Get build_portal_on_server function
    const buildMatch = content.match(
      /build_portal_on_server\(\) \{[\s\S]*?^}/m
    );
    assert.ok(buildMatch, "build_portal_on_server must exist");

    const funcBody = buildMatch[0];

    // Runs npm run build via ssh_command
    assert.ok(
      funcBody.includes("npm run build"),
      "build_portal_on_server must run npm run build"
    );

    // Checks exit status
    assert.ok(
      funcBody.includes("if [ $? -eq 0 ]; then") ||
      funcBody.includes("if ssh_command"),
      "build_portal_on_server must check build exit status"
    );

    // Has error branch
    assert.ok(
      funcBody.includes('log_error "Build failed"'),
      "build_portal_on_server must log error on build failure"
    );

    // Returns 1
    assert.ok(
      funcBody.includes("return 1"),
      "build_portal_on_server must return 1 on build failure"
    );
  }
);

test(
  "Given verify_portal_deployment function, when PM2 process is not online, then it returns 1",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-portal.sh");

    // Get verify_portal_deployment function
    const verifyMatch = content.match(
      /verify_portal_deployment\(\) \{[\s\S]*?^}/m
    );
    assert.ok(verifyMatch, "verify_portal_deployment must exist");

    const funcBody = verifyMatch[0];

    // Checks PM2 status for "online"
    assert.ok(
      funcBody.includes("grep -q") && funcBody.includes("online") ||
      funcBody.includes('echo "$PM2_OUTPUT" | grep -q "online"'),
      "verify_portal_deployment must check if PM2 status is 'online'"
    );

    // Logs error if not online
    assert.ok(
      funcBody.includes('log_error "PM2 process is not running"'),
      "verify_portal_deployment must log error if PM2 is not online"
    );

    // Returns 1
    assert.ok(
      funcBody.includes("return 1"),
      "verify_portal_deployment must return 1 if PM2 is not online"
    );
  }
);

test(
  "Given deploy.sh main function, when deploy_static fails in all mode, then portal deployment is skipped",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // Get case statement
    const caseBlock = content.match(/case "\$mode" in[\s\S]*?esac/);
    assert.ok(caseBlock, "case statement must exist");

    // Get 'all' case
    const allCaseMatch = caseBlock[0].match(/all\)[\s\S]*?;;/);
    assert.ok(allCaseMatch, "'all' case must exist");

    const allCaseBody = allCaseMatch[0];

    // deploy_static has || exit 1
    assert.ok(
      allCaseBody.includes("deploy_static || exit 1"),
      "'all' mode must exit if deploy_static fails"
    );

    // deploy_portal comes after
    const lines = allCaseBody.split("\n");
    let staticExitIndex = -1;
    let portalIndex = -1;

    lines.forEach((line, idx) => {
      if (line.includes("deploy_static || exit 1")) staticExitIndex = idx;
      if (line.includes("deploy_portal")) portalIndex = idx;
    });

    assert.ok(
      staticExitIndex >= 0 && portalIndex > staticExitIndex,
      "portal deployment must come after static with exit guard"
    );
  }
);

test(
  "Given sync_static_files function, when rsync fails, then it logs error and returns 1",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Get sync_static_files function
    const syncMatch = content.match(
      /sync_static_files\(\) \{[\s\S]*?^}/m
    );
    assert.ok(syncMatch, "sync_static_files must exist");

    const funcBody = syncMatch[0];

    // Checks rsync exit status
    assert.ok(
      funcBody.includes("if eval") || funcBody.includes("if $rsync_cmd"),
      "sync_static_files must check rsync exit status"
    );

    // Has error branch
    assert.ok(
      funcBody.includes('log_error "File sync failed"'),
      "sync_static_files must log error on rsync failure"
    );

    // Returns 1
    assert.ok(
      funcBody.includes("return 1"),
      "sync_static_files must return 1 on rsync failure"
    );
  }
);

test(
  "Given config validation, when required values are missing, then it exits with error",
  () => {
    const content = readFile("deploy_scripts/lib/config.sh");

    // Get validate_config function
    const validateMatch = content.match(
      /validate_config\(\) \{[\s\S]*?^}/m
    );
    assert.ok(validateMatch, "validate_config must exist");

    const funcBody = validateMatch[0];

    // Tracks errors
    assert.ok(
      funcBody.includes("local errors=0") || funcBody.includes("errors=0"),
      "validate_config must track error count"
    );

    // Checks DEPLOY_SSH_USER
    assert.ok(
      funcBody.includes("DEPLOY_SSH_USER") && funcBody.includes("is not set"),
      "validate_config must check DEPLOY_SSH_USER"
    );

    // Checks DEPLOY_SSH_HOST
    assert.ok(
      funcBody.includes("DEPLOY_SSH_HOST") && funcBody.includes("is not set"),
      "validate_config must check DEPLOY_SSH_HOST"
    );

    // Increments errors
    assert.ok(
      funcBody.includes("((errors++))") || funcBody.includes("errors=$((errors + 1))"),
      "validate_config must increment error count for each missing value"
    );

    // Exits if errors > 0
    assert.ok(
      funcBody.includes("[ $errors -gt 0 ]") && funcBody.includes("exit 1"),
      "validate_config must exit with status 1 if errors exist"
    );
  }
);

test(
  "Given test_ssh_connection function, when SSH fails, then it returns non-zero status",
  () => {
    const content = readFile("deploy_scripts/lib/ssh.sh");

    // Get test_ssh_connection function
    const testSshMatch = content.match(
      /test_ssh_connection\(\) \{[\s\S]*?^}/m
    );
    assert.ok(testSshMatch, "test_ssh_connection must exist");

    const funcBody = testSshMatch[0];

    // Runs SSH with exit command
    assert.ok(
      funcBody.includes("ssh") && funcBody.includes("'exit'"),
      "test_ssh_connection must run SSH with exit command"
    );

    // Returns SSH exit code
    assert.ok(
      funcBody.includes("return $?"),
      "test_ssh_connection must return SSH exit code"
    );
  }
);

test(
  "Given create_super_admin function, when admin creation fails, then it logs error and returns 1",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-portal.sh");

    // Get create_super_admin function
    const createAdminMatch = content.match(
      /create_super_admin\(\) \{[\s\S]*?^}/m
    );
    assert.ok(createAdminMatch, "create_super_admin must exist");

    const funcBody = createAdminMatch[0];

    // Checks create-super-admin.sh exit status
    assert.ok(
      funcBody.includes("if [ $? -eq 0 ]; then"),
      "create_super_admin must check create-super-admin.sh exit status"
    );

    // Has error branch
    assert.ok(
      funcBody.includes('log_error "Failed to create super admin"'),
      "create_super_admin must log error on failure"
    );

    // Returns 1
    assert.ok(
      funcBody.includes("return 1"),
      "create_super_admin must return 1 on failure"
    );
  }
);

test(
  "Given deploy_portal orchestration, when any step fails, then specific error message identifies the failing step",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-portal.sh");

    // Get deploy_portal function
    const deployPortalMatch = content.match(
      /deploy_portal\(\) \{[\s\S]*?^}/m
    );
    assert.ok(deployPortalMatch, "deploy_portal must exist");

    const funcBody = deployPortalMatch[0];

    // Each step has specific error message
    const errorMessages = [
      "file sync",
      "dependency installation",
      "environment setup",
      "admin creation",
      "build",
      "PM2 setup",
    ];

    errorMessages.forEach((stepName) => {
      assert.ok(
        funcBody.includes(stepName) || funcBody.toLowerCase().includes(stepName.toLowerCase()),
        `deploy_portal must have specific error message mentioning '${stepName}'`
      );
    });
  }
);

test(
  "Given all deployment functions, when checking error consistency, then failed operations return 1",
  () => {
    const buildContent = readFile("deploy_scripts/lib/build.sh");
    const staticContent = readFile("deploy_scripts/lib/deploy-static.sh");
    const portalContent = readFile("deploy_scripts/lib/deploy-portal.sh");

    const allContent = [buildContent, staticContent, portalContent].join("\n");

    // Count log_error calls
    const errorLogs = allContent.match(/log_error/g);
    assert.ok(
      errorLogs && errorLogs.length > 10,
      "deployment scripts must have multiple error logging points (found: " +
      (errorLogs ? errorLogs.length : 0) + ")"
    );

    // Count return 1 statements
    const errorReturns = allContent.match(/return 1/g);
    assert.ok(
      errorReturns && errorReturns.length > 10,
      "deployment scripts must return 1 on errors (found: " +
      (errorReturns ? errorReturns.length : 0) + ")"
    );
  }
);
