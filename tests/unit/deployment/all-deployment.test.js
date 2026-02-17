const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = process.cwd();

// ─── Helper Functions ────────────────────────────────────────────────────────

const readFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

// ─── Combined Deployment Tests ───────────────────────────────────────────────

test(
  "Given deploy.sh with --all flag, when checking mode determination, then determine_mode returns 'all'",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // determine_mode function exists
    assert.ok(
      content.includes("determine_mode()"),
      "deploy.sh must define determine_mode function"
    );

    // Get function body
    const determineModeMatch = content.match(
      /determine_mode\(\) \{[\s\S]*?^}/m
    );
    assert.ok(determineModeMatch, "determine_mode function must exist");

    const funcBody = determineModeMatch[0];

    // Checks DEPLOY_ALL flag
    assert.ok(
      funcBody.includes("DEPLOY_ALL"),
      "determine_mode must check DEPLOY_ALL flag"
    );

    // Returns 'all'
    assert.ok(
      funcBody.includes('echo "all"'),
      "determine_mode must return 'all' when DEPLOY_ALL is true"
    );

    // DEPLOY_ALL has highest priority
    const lines = funcBody.split("\n");
    let allCheckIndex = -1;
    let portalCheckIndex = -1;
    let staticCheckIndex = -1;

    lines.forEach((line, idx) => {
      if (line.includes('[ "$DEPLOY_ALL" = true ]')) allCheckIndex = idx;
      if (line.includes('[ "$DEPLOY_PORTAL" = true ]')) portalCheckIndex = idx;
      if (line.includes('echo "static"')) staticCheckIndex = idx;
    });

    assert.ok(
      allCheckIndex >= 0 && allCheckIndex < portalCheckIndex,
      "DEPLOY_ALL check must come before DEPLOY_PORTAL check"
    );
  }
);

test(
  "Given deploy.sh parsing --all flag, when checking argument parsing, then it sets DEPLOY_ALL=true",
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

    // Has --all case
    assert.ok(
      funcBody.includes("--all)"),
      "parse_arguments must handle --all flag"
    );

    // Sets DEPLOY_ALL=true
    assert.ok(
      funcBody.includes("DEPLOY_ALL=true"),
      "parse_arguments must set DEPLOY_ALL=true for --all flag"
    );
  }
);

test(
  "Given deploy.sh case statement, when mode is 'all', then it runs deploy_static then deploy_portal",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // Get case statement
    const caseBlock = content.match(/case "\$mode" in[\s\S]*?esac/);
    assert.ok(caseBlock, "deploy.sh must have case statement for mode");

    const caseBody = caseBlock[0];

    // Has 'all' case
    assert.ok(
      caseBody.includes("all)"),
      "case statement must handle 'all' mode"
    );

    // Extract 'all' case body
    const allCaseMatch = caseBody.match(/all\)[\s\S]*?;;/);
    assert.ok(allCaseMatch, "'all' case must exist");

    const allCaseBody = allCaseMatch[0];

    // Calls deploy_static
    assert.ok(
      allCaseBody.includes("deploy_static"),
      "'all' mode must call deploy_static"
    );

    // Calls deploy_portal
    assert.ok(
      allCaseBody.includes("deploy_portal"),
      "'all' mode must call deploy_portal"
    );

    // Order: static before portal
    const lines = allCaseBody.split("\n");
    let staticIndex = -1;
    let portalIndex = -1;

    lines.forEach((line, idx) => {
      if (line.includes("deploy_static")) staticIndex = idx;
      if (line.includes("deploy_portal")) portalIndex = idx;
    });

    assert.ok(
      staticIndex >= 0 && portalIndex >= 0,
      "'all' mode must call both deploy_static and deploy_portal"
    );

    assert.ok(
      staticIndex < portalIndex,
      "'all' mode must call deploy_static before deploy_portal"
    );

    // Each has || exit 1
    assert.ok(
      allCaseBody.includes("deploy_static || exit 1"),
      "'all' mode must exit on deploy_static failure"
    );

    assert.ok(
      allCaseBody.includes("deploy_portal || exit 1"),
      "'all' mode must exit on deploy_portal failure"
    );
  }
);

test(
  "Given deploy.sh --all mode, when checking config restoration, then static build restores config before portal deployment",
  () => {
    // This is tested indirectly through build.sh tests
    // build_static calls restore_next_config before exit
    // This ensures next.config.js is back to server mode for portal deployment

    const buildContent = readFile("deploy_scripts/lib/build.sh");

    // build_static restores config
    assert.ok(
      buildContent.includes("restore_next_config"),
      "build_static must restore config before exit"
    );

    // Trap ensures restoration on error
    assert.ok(
      buildContent.includes("trap restore_next_config EXIT"),
      "build_static must set trap for config restoration"
    );

    // Manual restore before normal exit
    const buildStaticMatch = buildContent.match(
      /build_static\(\) \{[\s\S]*?^}/m
    );
    assert.ok(buildStaticMatch, "build_static function must exist");

    const funcBody = buildStaticMatch[0];
    const lines = funcBody.split("\n");

    let hasManualRestore = false;
    let hasTrapRemoval = false;

    lines.forEach((line) => {
      if (line.trim() === "restore_next_config") hasManualRestore = true;
      if (line.includes("trap - EXIT")) hasTrapRemoval = true;
    });

    assert.ok(
      hasManualRestore,
      "build_static must manually restore config before normal exit"
    );

    assert.ok(
      hasTrapRemoval,
      "build_static must remove trap after manual restore"
    );
  }
);

test(
  "Given deploy.sh --all mode, when checking output, then it shows completion message for both deployments",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // Get main function
    const mainMatch = content.match(/^main\(\) \{[\s\S]*?^}/m);
    assert.ok(mainMatch, "main function must exist");

    const funcBody = mainMatch[0];

    // Shows final summary
    assert.ok(
      funcBody.includes("DEPLOYMENT COMPLETE") || funcBody.includes("log_section"),
      "main must show final deployment summary"
    );

    // Shows elapsed time
    assert.ok(
      funcBody.includes("log_elapsed_time"),
      "main must log total elapsed time"
    );

    // Shows deployment URLs
    assert.ok(
      funcBody.includes("DEPLOY_DOMAIN"),
      "main must show deployment domain"
    );

    // Conditional messages for static and portal
    assert.ok(
      funcBody.includes('[ "$mode" = "static" ]') ||
      funcBody.includes('[ "$mode" = "all" ]'),
      "main must have conditional output for static deployment"
    );

    assert.ok(
      funcBody.includes('[ "$mode" = "portal" ]') ||
      funcBody.includes('[ "$mode" = "all" ]'),
      "main must have conditional output for portal deployment"
    );
  }
);

test(
  "Given deploy.sh, when checking all mode sources, then it sources both deploy-static.sh and deploy-portal.sh",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // Sources deploy-static.sh
    assert.ok(
      content.includes('source "$SCRIPT_DIR/lib/deploy-static.sh"'),
      "deploy.sh must source deploy-static.sh"
    );

    // Sources deploy-portal.sh
    assert.ok(
      content.includes('source "$SCRIPT_DIR/lib/deploy-portal.sh"'),
      "deploy.sh must source deploy-portal.sh"
    );

    // Sources build.sh (used by deploy-static)
    assert.ok(
      content.includes('source "$SCRIPT_DIR/lib/build.sh"'),
      "deploy.sh must source build.sh"
    );

    // Sources ssh.sh (used by both)
    assert.ok(
      content.includes('source "$SCRIPT_DIR/lib/ssh.sh"'),
      "deploy.sh must source ssh.sh"
    );

    // Sources config.sh
    assert.ok(
      content.includes('source "$SCRIPT_DIR/lib/config.sh"'),
      "deploy.sh must source config.sh"
    );

    // Sources validation.sh
    assert.ok(
      content.includes('source "$SCRIPT_DIR/lib/validation.sh"'),
      "deploy.sh must source validation.sh"
    );

    // Sources output.sh
    assert.ok(
      content.includes('source "$SCRIPT_DIR/lib/output.sh"'),
      "deploy.sh must source output.sh"
    );
  }
);

test(
  "Given config validation for --all mode, when checking validation.sh, then it validates both DEPLOY_STATIC_PATH and DEPLOY_PORTAL_PATH",
  () => {
    const content = readFile("deploy_scripts/lib/config.sh");

    // validate_config function exists
    assert.ok(
      content.includes("validate_config()"),
      "config.sh must define validate_config function"
    );

    // Get function body
    const validateMatch = content.match(
      /validate_config\(\) \{[\s\S]*?^}/m
    );
    assert.ok(validateMatch, "validate_config function must exist");

    const funcBody = validateMatch[0];

    // Checks DEPLOY_MODE
    assert.ok(
      funcBody.includes("DEPLOY_MODE"),
      "validate_config must check DEPLOY_MODE"
    );

    // Validates static path for static or all
    assert.ok(
      funcBody.includes('"static"') && funcBody.includes('"all"') &&
      funcBody.includes("DEPLOY_STATIC_PATH"),
      "validate_config must validate DEPLOY_STATIC_PATH for static or all mode"
    );

    // Validates portal path for portal or all
    assert.ok(
      funcBody.includes('"portal"') && funcBody.includes('"all"') &&
      funcBody.includes("DEPLOY_PORTAL_PATH"),
      "validate_config must validate DEPLOY_PORTAL_PATH for portal or all mode"
    );
  }
);

test(
  "Given deploy.sh --all mode, when checking pre-flight checks, then run_all_checks validates both static and portal requirements",
  () => {
    const validationContent = readFile("deploy_scripts/lib/validation.sh");

    // run_all_checks function exists
    assert.ok(
      validationContent.includes("run_all_checks()"),
      "validation.sh must define run_all_checks function"
    );

    // Takes mode as parameter
    assert.ok(
      validationContent.includes('local mode="$1"') ||
      validationContent.includes("mode="),
      "run_all_checks must use mode parameter"
    );
  }
);

test(
  "Given deploy.sh help text, when checking documentation, then it shows --all flag usage",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // show_help function exists
    assert.ok(
      content.includes("show_help()"),
      "deploy.sh must define show_help function"
    );

    // Get help text
    const helpMatch = content.match(/show_help\(\) \{[\s\S]*?^}/m);
    assert.ok(helpMatch, "show_help function must exist");

    const helpText = helpMatch[0];

    // Documents --all flag
    assert.ok(
      helpText.includes("--all"),
      "help text must document --all flag"
    );

    // Describes what --all does
    assert.ok(
      helpText.includes("both") || helpText.includes("static and portal"),
      "help text must explain --all deploys both static and portal"
    );

    // Shows example
    assert.ok(
      helpText.includes("./deploy_scripts/deploy.sh --all") ||
      helpText.includes("deploy.sh --all"),
      "help text must show example of --all usage"
    );
  }
);

test(
  "Given deploy.sh --all mode execution, when checking separation, then static and portal output is separated by blank line",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // Get case statement
    const caseBlock = content.match(/case "\$mode" in[\s\S]*?esac/);
    assert.ok(caseBlock, "deploy.sh must have case statement");

    const caseBody = caseBlock[0];

    // Extract 'all' case
    const allCaseMatch = caseBody.match(/all\)[\s\S]*?;;/);
    assert.ok(allCaseMatch, "'all' case must exist");

    const allCaseBody = allCaseMatch[0];

    // Check for blank line between deployments
    const hasBlankLine = allCaseBody.includes('echo ""') ||
                         allCaseBody.includes("echo ''");

    assert.ok(
      hasBlankLine,
      "'all' mode should have blank line between static and portal deployment for readability"
    );
  }
);

test(
  "Given deploy_static and deploy_portal independence, when checking error handling, then static failure prevents portal deployment",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // Get 'all' case
    const caseBlock = content.match(/case "\$mode" in[\s\S]*?esac/);
    assert.ok(caseBlock, "case statement must exist");

    const allCaseMatch = caseBlock[0].match(/all\)[\s\S]*?;;/);
    assert.ok(allCaseMatch, "'all' case must exist");

    const allCaseBody = allCaseMatch[0];

    // deploy_static has || exit 1
    assert.ok(
      allCaseBody.includes("deploy_static || exit 1"),
      "static failure must exit before portal deployment"
    );

    // deploy_portal comes after static
    const lines = allCaseBody.split("\n");
    let staticExitIndex = -1;
    let portalCallIndex = -1;

    lines.forEach((line, idx) => {
      if (line.includes("deploy_static || exit 1")) staticExitIndex = idx;
      if (line.includes("deploy_portal")) portalCallIndex = idx;
    });

    assert.ok(
      staticExitIndex >= 0 && portalCallIndex > staticExitIndex,
      "portal deployment must come after static deployment with exit guard"
    );
  }
);

test(
  "Given deploy.sh completion for --all mode, when checking final URLs, then it shows both static site and portal URLs",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // Get main function
    const mainMatch = content.match(/^main\(\) \{[\s\S]*?^}/m);
    assert.ok(mainMatch, "main function must exist");

    const funcBody = mainMatch[0];

    // Shows static site URL for static or all
    assert.ok(
      funcBody.includes("Static site:") || funcBody.includes("https://"),
      "main must show static site URL"
    );

    // Shows portal URL for portal or all
    assert.ok(
      funcBody.includes("Portal:") || funcBody.includes("/portal/"),
      "main must show portal URL"
    );

    // Conditional based on mode
    assert.ok(
      funcBody.includes('[ "$mode" = "static" ]') ||
      funcBody.includes('[ "$mode" = "all" ]'),
      "main must conditionally show static URL based on mode"
    );

    assert.ok(
      funcBody.includes('[ "$mode" = "portal" ]') ||
      funcBody.includes('[ "$mode" = "all" ]'),
      "main must conditionally show portal URL based on mode"
    );
  }
);
