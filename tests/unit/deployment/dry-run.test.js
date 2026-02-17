const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = process.cwd();

// ─── Helper Functions ────────────────────────────────────────────────────────

const readFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

// ─── Dry-Run Mode Tests ──────────────────────────────────────────────────────

test(
  "Given deploy.sh parsing --dry-run flag, when checking argument parsing, then it sets DRY_RUN=true",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // parse_arguments function exists
    assert.ok(
      content.includes("parse_arguments()"),
      "deploy.sh must define parse_arguments function"
    );

    // Get function body
    const parseArgsMatch = content.match(
      /parse_arguments\(\) \{[\s\S]*?^}/m
    );
    assert.ok(parseArgsMatch, "parse_arguments function must exist");

    const funcBody = parseArgsMatch[0];

    // Has --dry-run case
    assert.ok(
      funcBody.includes("--dry-run)"),
      "parse_arguments must handle --dry-run flag"
    );

    // Sets DRY_RUN=true
    assert.ok(
      funcBody.includes("DRY_RUN=true"),
      "parse_arguments must set DRY_RUN=true for --dry-run flag"
    );

    // Exports DRY_RUN (may be on same line as other exports)
    assert.ok(
      content.includes("export DRY_RUN") ||
      (content.includes("export") && content.includes("DRY_RUN")),
      "deploy.sh must export DRY_RUN for use in sourced scripts"
    );
  }
);

test(
  "Given deploy.sh parsing --verbose flag, when checking argument parsing, then it sets VERBOSE=true",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    const parseArgsMatch = content.match(
      /parse_arguments\(\) \{[\s\S]*?^}/m
    );
    assert.ok(parseArgsMatch, "parse_arguments function must exist");

    const funcBody = parseArgsMatch[0];

    // Has --verbose case
    assert.ok(
      funcBody.includes("--verbose)"),
      "parse_arguments must handle --verbose flag"
    );

    // Sets VERBOSE=true
    assert.ok(
      funcBody.includes("VERBOSE=true"),
      "parse_arguments must set VERBOSE=true for --verbose flag"
    );

    // Exports VERBOSE (may be on same line as other exports)
    assert.ok(
      content.includes("export VERBOSE") ||
      (content.includes("export") && content.includes("VERBOSE")),
      "deploy.sh must export VERBOSE for use in sourced scripts"
    );
  }
);

test(
  "Given deploy.sh parsing --debug flag, when checking argument parsing, then it sets DEBUG=true and VERBOSE=true",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    const parseArgsMatch = content.match(
      /parse_arguments\(\) \{[\s\S]*?^}/m
    );
    assert.ok(parseArgsMatch, "parse_arguments function must exist");

    const funcBody = parseArgsMatch[0];

    // Has --debug case
    assert.ok(
      funcBody.includes("--debug)"),
      "parse_arguments must handle --debug flag"
    );

    // Sets DEBUG=true
    assert.ok(
      funcBody.includes("DEBUG=true"),
      "parse_arguments must set DEBUG=true for --debug flag"
    );

    // Sets VERBOSE=true (debug implies verbose)
    const debugCaseMatch = funcBody.match(/--debug\)[\s\S]*?shift/);
    assert.ok(
      debugCaseMatch && debugCaseMatch[0].includes("VERBOSE=true"),
      "parse_arguments must set VERBOSE=true when DEBUG=true (debug implies verbose)"
    );

    // Exports DEBUG (may be on same line as other exports)
    assert.ok(
      content.includes("export DEBUG") ||
      (content.includes("export") && content.includes("DEBUG")),
      "deploy.sh must export DEBUG for use in sourced scripts"
    );
  }
);

test(
  "Given deploy.sh with --dry-run, when checking pre-flight checks, then run_all_checks is skipped",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // Get main function
    const mainMatch = content.match(/^main\(\) \{[\s\S]*?^}/m);
    assert.ok(mainMatch, "main function must exist");

    const funcBody = mainMatch[0];

    // run_all_checks is conditional on DRY_RUN
    assert.ok(
      funcBody.includes('[ "$DRY_RUN" != true ]') &&
      funcBody.includes("run_all_checks"),
      "main must skip run_all_checks in dry-run mode"
    );
  }
);

test(
  "Given deploy.sh with --dry-run, when checking confirmation prompt, then it is skipped",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // Get main function
    const mainMatch = content.match(/^main\(\) \{[\s\S]*?^}/m);
    assert.ok(mainMatch, "main function must exist");

    const funcBody = mainMatch[0];

    // confirm_deployment is conditional on DRY_RUN
    assert.ok(
      funcBody.includes('[ "$DRY_RUN" != true ]') &&
      funcBody.includes("confirm_deployment"),
      "main must skip confirm_deployment in dry-run mode"
    );
  }
);

test(
  "Given build.sh functions, when checking dry-run handling, then configure_static_build logs what it would do",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // configure_static_build checks DRY_RUN
    const configureMatch = content.match(
      /configure_static_build\(\) \{[\s\S]*?^}/m
    );
    assert.ok(configureMatch, "configure_static_build must exist");

    const funcBody = configureMatch[0];

    assert.ok(
      funcBody.includes('[ "${DRY_RUN:-false}" = true ]'),
      "configure_static_build must check DRY_RUN flag"
    );

    assert.ok(
      funcBody.includes("log_dry_run"),
      "configure_static_build must use log_dry_run in dry-run mode"
    );

    assert.ok(
      funcBody.includes("return 0"),
      "configure_static_build must return 0 in dry-run mode"
    );
  }
);

test(
  "Given build.sh functions, when checking dry-run handling, then build_static logs but doesn't run npm",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // build_static checks DRY_RUN
    const buildStaticMatch = content.match(
      /build_static\(\) \{[\s\S]*?^}/m
    );
    assert.ok(buildStaticMatch, "build_static must exist");

    const funcBody = buildStaticMatch[0];

    assert.ok(
      funcBody.includes('[ "${DRY_RUN:-false}" = true ]') ||
      funcBody.includes('[ "${DRY_RUN:-false}" != true ]'),
      "build_static must check DRY_RUN flag"
    );

    assert.ok(
      funcBody.includes("log_dry_run") && funcBody.includes("npm run build"),
      "build_static must log what npm command would run in dry-run mode"
    );
  }
);

test(
  "Given SSH helper functions, when checking dry-run handling, then ssh_command returns 0 without executing",
  () => {
    const content = readFile("deploy_scripts/lib/ssh.sh");

    // ssh_command checks DRY_RUN
    const sshCommandMatch = content.match(
      /ssh_command\(\) \{[\s\S]*?^}/m
    );
    assert.ok(sshCommandMatch, "ssh_command must exist");

    const funcBody = sshCommandMatch[0];

    assert.ok(
      funcBody.includes('[ "${DRY_RUN:-false}" = true ]'),
      "ssh_command must check DRY_RUN flag"
    );

    assert.ok(
      funcBody.includes("return 0"),
      "ssh_command must return 0 in dry-run mode (simulate success)"
    );

    // Optionally logs command if VERBOSE
    assert.ok(
      funcBody.includes('[ "${VERBOSE:-false}" = true ]'),
      "ssh_command should optionally log command in verbose dry-run mode"
    );
  }
);

test(
  "Given deploy-static.sh functions, when checking dry-run handling, then sync_static_files logs but doesn't rsync",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // sync_static_files checks DRY_RUN
    const syncMatch = content.match(
      /sync_static_files\(\) \{[\s\S]*?^}/m
    );
    assert.ok(syncMatch, "sync_static_files must exist");

    const funcBody = syncMatch[0];

    assert.ok(
      funcBody.includes('[ "${DRY_RUN:-false}" = true ]'),
      "sync_static_files must check DRY_RUN flag"
    );

    assert.ok(
      funcBody.includes("log_dry_run"),
      "sync_static_files must use log_dry_run"
    );

    assert.ok(
      funcBody.includes("return 0"),
      "sync_static_files must return 0 in dry-run mode"
    );

    // Shows what would be synced
    assert.ok(
      funcBody.includes("DEPLOY_STATIC_PATH") || funcBody.includes("out/"),
      "sync_static_files dry-run message should mention source/destination"
    );
  }
);

test(
  "Given deploy-portal.sh functions, when checking dry-run handling, then sync_portal_files shows exclusions in verbose mode",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-portal.sh");

    // sync_portal_files checks DRY_RUN
    const syncMatch = content.match(
      /sync_portal_files\(\) \{[\s\S]*?^}/m
    );
    assert.ok(syncMatch, "sync_portal_files must exist");

    const funcBody = syncMatch[0];

    assert.ok(
      funcBody.includes('[ "${DRY_RUN:-false}" = true ]'),
      "sync_portal_files must check DRY_RUN flag"
    );

    assert.ok(
      funcBody.includes("log_dry_run"),
      "sync_portal_files must use log_dry_run"
    );

    // Shows exclusions if verbose
    assert.ok(
      funcBody.includes('[ "${VERBOSE:-false}" = true ]') &&
      (funcBody.includes("Excludes:") || funcBody.includes("node_modules")),
      "sync_portal_files should show exclusions in verbose dry-run mode"
    );

    assert.ok(
      funcBody.includes("return 0"),
      "sync_portal_files must return 0 in dry-run mode"
    );
  }
);

test(
  "Given deploy-portal.sh setup_portal_environment, when checking dry-run, then it logs what secrets would be prompted for",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-portal.sh");

    // setup_portal_environment checks DRY_RUN
    const setupMatch = content.match(
      /setup_portal_environment\(\) \{[\s\S]*?^}/m
    );
    assert.ok(setupMatch, "setup_portal_environment must exist");

    const funcBody = setupMatch[0];

    assert.ok(
      funcBody.includes('[ "${DRY_RUN:-false}" = true ]'),
      "setup_portal_environment must check DRY_RUN flag"
    );

    assert.ok(
      funcBody.includes("log_dry_run"),
      "setup_portal_environment must use log_dry_run"
    );

    // Shows what would be prompted
    assert.ok(
      funcBody.includes("database password") || funcBody.includes("DB_PASS"),
      "setup_portal_environment dry-run should mention database password"
    );

    assert.ok(
      funcBody.includes("SMTP password") || funcBody.includes("SMTP_PASS"),
      "setup_portal_environment dry-run should mention SMTP password"
    );

    assert.ok(
      funcBody.includes("session secret") || funcBody.includes("SESSION_SECRET"),
      "setup_portal_environment dry-run should mention session secret"
    );
  }
);

test(
  "Given deploy-portal.sh manage_pm2, when checking dry-run, then it logs PM2 operations without executing",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-portal.sh");

    // manage_pm2 checks DRY_RUN
    const pm2Match = content.match(
      /manage_pm2\(\) \{[\s\S]*?^}/m
    );
    assert.ok(pm2Match, "manage_pm2 must exist");

    const funcBody = pm2Match[0];

    assert.ok(
      funcBody.includes('[ "${DRY_RUN:-false}" = true ]'),
      "manage_pm2 must check DRY_RUN flag"
    );

    assert.ok(
      funcBody.includes("log_dry_run"),
      "manage_pm2 must use log_dry_run"
    );

    // Shows PM2 operations
    assert.ok(
      funcBody.includes("PM2") && funcBody.includes("DEPLOY_PM2_APP_NAME"),
      "manage_pm2 dry-run should mention PM2 app name"
    );

    assert.ok(
      funcBody.includes("start/restart") || funcBody.includes("save"),
      "manage_pm2 dry-run should mention PM2 operations"
    );

    assert.ok(
      funcBody.includes("return 0"),
      "manage_pm2 must return 0 in dry-run mode"
    );
  }
);

test(
  "Given validation functions, when checking dry-run, then they log checks but don't actually validate",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // validate_out_directory checks DRY_RUN
    const validateMatch = content.match(
      /validate_out_directory\(\) \{[\s\S]*?^}/m
    );
    assert.ok(validateMatch, "validate_out_directory must exist");

    const funcBody = validateMatch[0];

    assert.ok(
      funcBody.includes('[ "${DRY_RUN:-false}" = true ]'),
      "validate_out_directory must check DRY_RUN flag"
    );

    assert.ok(
      funcBody.includes("log_dry_run"),
      "validate_out_directory must use log_dry_run"
    );

    assert.ok(
      funcBody.includes("return 0"),
      "validate_out_directory must return 0 in dry-run mode"
    );
  }
);

test(
  "Given output.sh library, when checking functions, then it provides log_dry_run for dry-run messages",
  () => {
    const content = readFile("deploy_scripts/lib/output.sh");

    // log_dry_run function exists
    assert.ok(
      content.includes("log_dry_run"),
      "output.sh must define log_dry_run function"
    );

    // Shows distinctive prefix (e.g., "[DRY-RUN]")
    const logDryRunMatch = content.match(
      /log_dry_run[^}]*?\{[\s\S]*?^}/m
    );

    if (logDryRunMatch) {
      assert.ok(
        logDryRunMatch[0].includes("DRY") || logDryRunMatch[0].includes("dry"),
        "log_dry_run should include 'DRY' or 'dry' in output for clarity"
      );
    }
  }
);

test(
  "Given deploy.sh help text, when checking --dry-run documentation, then it explains dry-run shows plan without executing",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // Get help text
    const helpMatch = content.match(/show_help\(\) \{[\s\S]*?^EOF/m);
    assert.ok(helpMatch, "show_help must exist");

    const helpText = helpMatch[0];

    // Documents --dry-run
    assert.ok(
      helpText.includes("--dry-run"),
      "help text must document --dry-run flag"
    );

    // Explains what dry-run does
    assert.ok(
      helpText.includes("Show what would happen") ||
      helpText.includes("without executing"),
      "help text must explain --dry-run shows plan without executing"
    );

    // Documents --verbose
    assert.ok(
      helpText.includes("--verbose"),
      "help text must document --verbose flag"
    );

    // Explains verbose is for dry-run details
    assert.ok(
      helpText.includes("detailed") || helpText.includes("dry-run"),
      "help text must explain --verbose shows detailed dry-run output"
    );

    // Shows example
    assert.ok(
      helpText.includes("--dry-run") && helpText.includes("./deploy"),
      "help text must show example of --dry-run usage"
    );
  }
);

test(
  "Given all deployment functions, when checking dry-run consistency, then they all return 0 to simulate success",
  () => {
    const buildContent = readFile("deploy_scripts/lib/build.sh");
    const sshContent = readFile("deploy_scripts/lib/ssh.sh");
    const staticContent = readFile("deploy_scripts/lib/deploy-static.sh");
    const portalContent = readFile("deploy_scripts/lib/deploy-portal.sh");

    const allContent = [buildContent, sshContent, staticContent, portalContent].join("\n");

    // Find all DRY_RUN checks
    const dryRunChecks = allContent.match(/\[ "\$\{DRY_RUN:-false\}" = true \]/g);

    assert.ok(
      dryRunChecks && dryRunChecks.length > 10,
      "deployment scripts must have multiple DRY_RUN checks (found: " +
      (dryRunChecks ? dryRunChecks.length : 0) + ")"
    );

    // Each DRY_RUN block should have return 0
    // This is a best-effort check since code structure varies
    const lines = allContent.split("\n");
    let inDryRunBlock = false;
    let dryRunBlocksWithReturn = 0;
    let totalDryRunBlocks = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('[ "${DRY_RUN:-false}" = true ]')) {
        inDryRunBlock = true;
        totalDryRunBlocks++;
      }
      if (inDryRunBlock && lines[i].includes("return 0")) {
        dryRunBlocksWithReturn++;
        inDryRunBlock = false;
      }
      if (inDryRunBlock && (lines[i].includes("fi") || lines[i].trim() === "}")) {
        inDryRunBlock = false;
      }
    }

    assert.ok(
      dryRunBlocksWithReturn > 10,
      `Most DRY_RUN blocks must return 0 (found ${dryRunBlocksWithReturn} of ${totalDryRunBlocks})`
    );
  }
);

test(
  "Given deploy.sh with --dry-run --verbose, when checking deployment plan, then show_deployment_plan displays configuration",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // show_deployment_plan is called
    assert.ok(
      content.includes("show_deployment_plan"),
      "deploy.sh must call show_deployment_plan"
    );

    // Takes mode as parameter
    const mainMatch = content.match(/^main\(\) \{[\s\S]*?^}/m);
    assert.ok(mainMatch, "main function must exist");

    assert.ok(
      mainMatch[0].includes('show_deployment_plan "$mode"') ||
      mainMatch[0].includes("show_deployment_plan"),
      "main must call show_deployment_plan with mode"
    );
  }
);

test(
  "Given deploy.sh with --debug flag, when checking output, then show_config displays full configuration",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // Get main function
    const mainMatch = content.match(/^main\(\) \{[\s\S]*?^}/m);
    assert.ok(mainMatch, "main function must exist");

    const funcBody = mainMatch[0];

    // Conditionally shows config if DEBUG
    assert.ok(
      funcBody.includes('[ "$DEBUG" = true ]') &&
      funcBody.includes("show_config"),
      "main must call show_config when DEBUG=true"
    );
  }
);
