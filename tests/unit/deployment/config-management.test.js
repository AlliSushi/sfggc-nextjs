const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = process.cwd();
const buildLibPath = path.join(projectRoot, "deploy_scripts/lib/build.sh");

// ─── Helper Functions ────────────────────────────────────────────────────────

const readFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

// ─── Config Backup/Restore Tests ─────────────────────────────────────────────

test(
  "Given backup_next_config function, when checking source, then it copies next.config.js to next.config.js.backup",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // Function exists
    assert.ok(
      content.includes("backup_next_config()"),
      "build.sh must define backup_next_config function"
    );

    // Checks if next.config.js exists
    assert.ok(
      content.includes('[ -f "next.config.js" ]'),
      "backup_next_config must check if next.config.js exists"
    );

    // Creates backup
    assert.ok(
      content.includes("cp next.config.js next.config.js.backup"),
      "backup_next_config must copy next.config.js to .backup file"
    );
  }
);

test(
  "Given restore_next_config function, when checking source, then it moves next.config.js.backup back to next.config.js",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // Function exists
    assert.ok(
      content.includes("restore_next_config()"),
      "build.sh must define restore_next_config function"
    );

    // Checks if backup exists
    assert.ok(
      content.includes('[ -f "next.config.js.backup" ]'),
      "restore_next_config must check if backup file exists"
    );

    // Restores backup
    assert.ok(
      content.includes("mv next.config.js.backup next.config.js"),
      "restore_next_config must move backup back to original location"
    );
  }
);

test(
  "Given configure_static_build function, when checking source, then it creates next.config.js with output: 'export'",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // Function exists
    assert.ok(
      content.includes("configure_static_build()"),
      "build.sh must define configure_static_build function"
    );

    // Creates config with output: 'export'
    assert.ok(
      content.includes("output: 'export'"),
      "configure_static_build must set output: 'export' for static mode"
    );

    // Sets images.unoptimized
    assert.ok(
      content.includes("images: {") && content.includes("unoptimized: true"),
      "configure_static_build must set images.unoptimized: true"
    );

    // Excludes portal routes
    assert.ok(
      content.includes("exportPathMap"),
      "configure_static_build must define exportPathMap"
    );

    assert.ok(
      content.includes("!path.startsWith('/portal')"),
      "exportPathMap must exclude /portal routes"
    );

    assert.ok(
      content.includes("!path.startsWith('/api/portal')"),
      "exportPathMap must exclude /api/portal routes"
    );
  }
);

test(
  "Given build_static function, when checking source, then it uses trap to ensure restore runs on exit",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // Function exists
    assert.ok(
      content.includes("build_static()"),
      "build.sh must define build_static function"
    );

    // Calls backup first
    assert.ok(
      content.includes("backup_next_config"),
      "build_static must call backup_next_config before modifying config"
    );

    // Sets trap for exit
    assert.ok(
      content.includes("trap restore_next_config EXIT"),
      "build_static must set trap to restore config on exit"
    );

    // Calls configure
    assert.ok(
      content.includes("configure_static_build"),
      "build_static must call configure_static_build"
    );

    // Restores config manually
    assert.ok(
      content.includes("restore_next_config"),
      "build_static must call restore_next_config manually before exit"
    );

    // Removes trap after manual restore
    assert.ok(
      content.includes("trap - EXIT"),
      "build_static must remove trap after manual restore"
    );
  }
);

test(
  "Given build_static function, when checking error handling, then it restores config and exits on build failure",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // Checks build success
    assert.ok(
      content.includes("if npm run build; then"),
      "build_static must check npm run build exit status"
    );

    // Error branch exists
    const hasElseBranch = content.match(/else\s+log_error "Build failed"/);
    assert.ok(
      hasElseBranch,
      "build_static must have else branch for build failure"
    );

    // Restores on error
    const lines = content.split("\n");
    let inErrorHandler = false;
    let hasRestoreInError = false;
    let hasExitInError = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('log_error "Build failed"')) {
        inErrorHandler = true;
      }
      if (inErrorHandler) {
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
      "build_static must call restore_next_config on build failure"
    );

    assert.ok(
      hasExitInError,
      "build_static must exit with status 1 on build failure"
    );
  }
);

test(
  "Given build_portal_local function, when checking source, then it creates server-mode config without output: 'export'",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // Function exists
    assert.ok(
      content.includes("build_portal_local()"),
      "build.sh must define build_portal_local function"
    );

    // Checks for 'output: export' in current config
    assert.ok(
      content.includes('grep -q "output.*export" next.config.js'),
      "build_portal_local must check if current config has output: 'export'"
    );

    // Backs up config if found
    assert.ok(
      content.includes("backup_next_config"),
      "build_portal_local must backup config before modifying"
    );

    // Creates server-mode config (no output: 'export')
    const lines = content.split("\n");
    let inPortalConfig = false;
    let hasOutputExport = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("build_portal_local()")) {
        inPortalConfig = true;
      }
      if (inPortalConfig && lines[i].includes("cat > next.config.js")) {
        // Check next ~15 lines for output: 'export'
        for (let j = i; j < Math.min(i + 15, lines.length); j++) {
          if (lines[j].includes("output: 'export'")) {
            hasOutputExport = true;
            break;
          }
        }
        break;
      }
    }

    assert.ok(
      !hasOutputExport,
      "build_portal_local server-mode config must NOT have output: 'export'"
    );
  }
);

test(
  "Given validate_out_directory function, when checking source, then it validates out/ exists and contains files",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // Function exists
    assert.ok(
      content.includes("validate_out_directory()"),
      "build.sh must define validate_out_directory function"
    );

    // Checks if out/ exists
    assert.ok(
      content.includes('[ ! -d "out" ]'),
      "validate_out_directory must check if out/ directory exists"
    );

    // Counts files
    assert.ok(
      content.includes("find out -type f"),
      "validate_out_directory must count files in out/"
    );

    // Counts HTML files
    assert.ok(
      content.includes('find out -name "*.html"'),
      "validate_out_directory must count HTML files in out/"
    );

    // Checks for empty directory
    assert.ok(
      content.includes('[ "$file_count" -eq 0 ]'),
      "validate_out_directory must check if directory is empty"
    );

    // Checks for HTML files
    assert.ok(
      content.includes('[ "$html_count" -eq 0 ]'),
      "validate_out_directory must check if HTML files exist"
    );
  }
);

test(
  "Given validate_next_build function, when checking source, then it validates .next/ directory exists",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // Function exists
    assert.ok(
      content.includes("validate_next_build()"),
      "build.sh must define validate_next_build function"
    );

    // Checks if .next/ exists
    assert.ok(
      content.includes('[ ! -d ".next" ]'),
      "validate_next_build must check if .next/ directory exists"
    );

    // Returns error if missing
    assert.ok(
      content.includes('log_error "Build output directory \'.next/\' not found"'),
      "validate_next_build must log error if .next/ not found"
    );
  }
);

test(
  "Given build.sh, when checking DRY_RUN handling, then all build functions respect DRY_RUN flag",
  () => {
    const content = readFile("deploy_scripts/lib/build.sh");

    // configure_static_build respects DRY_RUN
    const configureBlock = content.match(
      /configure_static_build\(\) \{[\s\S]*?^\}/m
    );
    assert.ok(
      configureBlock && configureBlock[0].includes('[ "${DRY_RUN:-false}" = true ]'),
      "configure_static_build must check DRY_RUN flag"
    );

    // build_static respects DRY_RUN
    assert.ok(
      content.includes('[ "${DRY_RUN:-false}" != true ]') ||
      content.includes('[ "${DRY_RUN:-false}" = true ]'),
      "build_static must check DRY_RUN flag"
    );

    // validate_out_directory respects DRY_RUN
    const validateBlock = content.match(
      /validate_out_directory\(\) \{[\s\S]*?^\}/m
    );
    assert.ok(
      validateBlock && validateBlock[0].includes('[ "${DRY_RUN:-false}" = true ]'),
      "validate_out_directory must check DRY_RUN flag"
    );
  }
);

test(
  "Given deploy-static.sh, when checking source, then deploy_static calls build_static to ensure fresh build",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // deploy_static function exists
    assert.ok(
      content.includes("deploy_static()"),
      "deploy-static.sh must define deploy_static function"
    );

    // Calls build_static
    assert.ok(
      content.includes("build_static"),
      "deploy_static must call build_static to ensure fresh build"
    );

    // Comment indicates fresh build
    assert.ok(
      content.includes("Always build fresh") || content.includes("Building static site"),
      "deploy_static must comment about fresh build"
    );
  }
);

test(
  "Given deployment scripts, when checking config lifecycle, then no .backup files remain after successful completion",
  () => {
    const buildContent = readFile("deploy_scripts/lib/build.sh");

    // build_static removes trap after restore
    assert.ok(
      buildContent.includes("trap - EXIT"),
      "build_static must remove trap after manual restore to prevent duplicate cleanup"
    );

    // build_portal_local restores and removes trap
    const portalLines = buildContent.split("\n");
    let inPortalLocal = false;
    let hasConditionalRestore = false;

    for (let i = 0; i < portalLines.length; i++) {
      if (portalLines[i].includes("build_portal_local()")) {
        inPortalLocal = true;
      }
      if (inPortalLocal && portalLines[i].includes('[ -f "next.config.js.backup" ]')) {
        hasConditionalRestore = true;
      }
    }

    assert.ok(
      hasConditionalRestore,
      "build_portal_local must conditionally restore only if backup exists"
    );
  }
);
