const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = process.cwd();

// ─── Helper Functions ────────────────────────────────────────────────────────

const readFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

// ─── Static Deployment Tests ─────────────────────────────────────────────────

test(
  "Given deploy_static function, when checking source, then it calls build_static to ensure fresh build",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Function exists
    assert.ok(
      content.includes("deploy_static()"),
      "deploy-static.sh must define deploy_static function"
    );

    // Calls build_static
    assert.ok(
      content.includes("build_static"),
      "deploy_static must call build_static"
    );

    // Comment about fresh build
    assert.ok(
      content.includes("Always build fresh") || content.includes("Building static site"),
      "deploy_static must indicate it builds fresh"
    );
  }
);

test(
  "Given deploy_static function, when checking orchestration, then it follows correct sequence: build, backup, sync, htaccess, verify",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Get deploy_static function
    const deployStaticMatch = content.match(
      /deploy_static\(\) \{[\s\S]*?^}/m
    );
    assert.ok(deployStaticMatch, "deploy_static function must exist");

    const funcBody = deployStaticMatch[0];
    const lines = funcBody.split("\n");

    // Find order of operations
    let buildIndex = -1;
    let backupIndex = -1;
    let syncIndex = -1;
    let htaccessIndex = -1;
    let verifyIndex = -1;

    lines.forEach((line, idx) => {
      if (line.includes("build_static")) buildIndex = idx;
      if (line.includes("create_static_backup")) backupIndex = idx;
      if (line.includes("sync_static_files")) syncIndex = idx;
      if (line.includes("deploy_htaccess")) htaccessIndex = idx;
      if (line.includes("verify_static_deployment")) verifyIndex = idx;
    });

    // Verify order
    assert.ok(buildIndex >= 0, "deploy_static must call build_static");
    assert.ok(backupIndex >= 0, "deploy_static must call create_static_backup");
    assert.ok(syncIndex >= 0, "deploy_static must call sync_static_files");
    assert.ok(htaccessIndex >= 0, "deploy_static must call deploy_htaccess");
    assert.ok(verifyIndex >= 0, "deploy_static must call verify_static_deployment");

    assert.ok(
      buildIndex < backupIndex,
      "build_static must run before create_static_backup"
    );
    assert.ok(
      backupIndex < syncIndex,
      "create_static_backup must run before sync_static_files"
    );
    assert.ok(
      syncIndex < htaccessIndex,
      "sync_static_files must run before deploy_htaccess"
    );
    assert.ok(
      htaccessIndex < verifyIndex,
      "deploy_htaccess must run before verify_static_deployment"
    );
  }
);

test(
  "Given generate_htaccess function, when checking source, then it creates .htaccess with compression, caching, and security headers",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Function exists
    assert.ok(
      content.includes("generate_htaccess()"),
      "deploy-static.sh must define generate_htaccess function"
    );

    // Takes target directory as parameter
    assert.ok(
      content.includes('local target_dir="$1"'),
      "generate_htaccess must accept target_dir parameter"
    );

    // Creates .htaccess
    assert.ok(
      content.includes('cat > "$target_dir/.htaccess"'),
      "generate_htaccess must write to .htaccess file"
    );

    // Enables compression
    assert.ok(
      content.includes("mod_deflate"),
      "generate_htaccess must enable mod_deflate for compression"
    );

    assert.ok(
      content.includes("AddOutputFilterByType DEFLATE"),
      "generate_htaccess must configure DEFLATE for various content types"
    );

    // Configures caching
    assert.ok(
      content.includes("mod_expires"),
      "generate_htaccess must configure mod_expires for caching"
    );

    assert.ok(
      content.includes("ExpiresActive on") &&
      content.includes("ExpiresByType"),
      "generate_htaccess must set expiration for static assets"
    );

    // Security headers
    assert.ok(
      content.includes("mod_headers"),
      "generate_htaccess must configure mod_headers for security"
    );

    assert.ok(
      content.includes("X-Content-Type-Options"),
      "generate_htaccess must set X-Content-Type-Options header"
    );

    assert.ok(
      content.includes("X-Frame-Options"),
      "generate_htaccess must set X-Frame-Options header"
    );

    assert.ok(
      content.includes("X-XSS-Protection"),
      "generate_htaccess must set X-XSS-Protection header"
    );
  }
);

test(
  "Given create_static_backup function, when checking source, then it creates timestamped backup on server",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Function exists
    assert.ok(
      content.includes("create_static_backup()"),
      "deploy-static.sh must define create_static_backup function"
    );

    // Checks if directory exists
    assert.ok(
      content.includes('[ -d "$DEPLOY_STATIC_PATH" ]') ||
      content.includes('ssh_command "[ -d'),
      "create_static_backup must check if deployment directory exists"
    );

    // Creates timestamp
    assert.ok(
      content.includes("timestamp=$(date +%Y%m%d_%H%M%S)"),
      "create_static_backup must create timestamp for backup"
    );

    // Creates backup path
    assert.ok(
      content.includes("backup_path") &&
      content.includes("_backup_"),
      "create_static_backup must create timestamped backup path"
    );

    // Uses cp -r
    assert.ok(
      content.includes("cp -r"),
      "create_static_backup must use cp -r for recursive backup"
    );

    // Respects DRY_RUN
    assert.ok(
      content.includes('[ "${DRY_RUN:-false}" = true ]'),
      "create_static_backup must check DRY_RUN flag"
    );
  }
);

test(
  "Given sync_static_files function, when checking source, then it uses rsync with --delete flag",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Function exists
    assert.ok(
      content.includes("sync_static_files()"),
      "deploy-static.sh must define sync_static_files function"
    );

    // Uses rsync
    assert.ok(
      content.includes("rsync"),
      "sync_static_files must use rsync for file transfer"
    );

    // Uses --delete flag
    assert.ok(
      content.includes("--delete"),
      "sync_static_files must use --delete to remove old files"
    );

    // Syncs out/ directory
    assert.ok(
      content.includes("out/"),
      "sync_static_files must sync out/ directory"
    );

    // Uses DEPLOY_STATIC_PATH
    assert.ok(
      content.includes("${DEPLOY_STATIC_PATH}"),
      "sync_static_files must sync to DEPLOY_STATIC_PATH"
    );

    // Uses SSH variables
    assert.ok(
      content.includes("${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}"),
      "sync_static_files must use DEPLOY_SSH_USER and DEPLOY_SSH_HOST"
    );

    // Respects DRY_RUN
    assert.ok(
      content.includes('[ "${DRY_RUN:-false}" = true ]'),
      "sync_static_files must check DRY_RUN flag"
    );
  }
);

test(
  "Given deploy_htaccess function, when checking source, then it creates .htaccess on server via SSH",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Function exists
    assert.ok(
      content.includes("deploy_htaccess()"),
      "deploy-static.sh must define deploy_htaccess function"
    );

    // Uses ssh_command
    assert.ok(
      content.includes("ssh_command"),
      "deploy_htaccess must use ssh_command helper"
    );

    // Creates .htaccess via heredoc
    assert.ok(
      content.includes("cat >") && content.includes(".htaccess"),
      "deploy_htaccess must create .htaccess using cat >"
    );

    // Uses HTACCESS_EOF heredoc marker
    assert.ok(
      content.includes("HTACCESS_EOF"),
      "deploy_htaccess must use HTACCESS_EOF heredoc marker"
    );

    // Contains mod_deflate
    assert.ok(
      content.includes("mod_deflate"),
      "deploy_htaccess .htaccess content must include mod_deflate"
    );

    // Respects DRY_RUN
    assert.ok(
      content.includes('[ "${DRY_RUN:-false}" = true ]'),
      "deploy_htaccess must check DRY_RUN flag"
    );
  }
);

test(
  "Given verify_static_deployment function, when checking source, then it verifies index.html exists on server",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Function exists
    assert.ok(
      content.includes("verify_static_deployment()"),
      "deploy-static.sh must define verify_static_deployment function"
    );

    // Checks for index.html
    assert.ok(
      content.includes("index.html"),
      "verify_static_deployment must check for index.html"
    );

    // Uses ssh_command
    assert.ok(
      content.includes("ssh_command"),
      "verify_static_deployment must use ssh_command for remote check"
    );

    // Uses [ -f ] test
    assert.ok(
      content.includes("[ -f"),
      "verify_static_deployment must use [ -f ] to test file existence"
    );

    // Uses DEPLOY_STATIC_PATH
    assert.ok(
      content.includes("${DEPLOY_STATIC_PATH}"),
      "verify_static_deployment must check path in DEPLOY_STATIC_PATH"
    );

    // Respects DRY_RUN
    assert.ok(
      content.includes('[ "${DRY_RUN:-false}" = true ]'),
      "verify_static_deployment must check DRY_RUN flag"
    );
  }
);

test(
  "Given verify_static_deployment function, when checking source, then it optionally tests HTTP response with curl",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Checks if curl is available
    assert.ok(
      content.includes("command -v curl"),
      "verify_static_deployment must check if curl is available"
    );

    // Tests DEPLOY_DOMAIN if set
    assert.ok(
      content.includes("${DEPLOY_DOMAIN}") || content.includes("DEPLOY_DOMAIN"),
      "verify_static_deployment must use DEPLOY_DOMAIN for HTTP test"
    );

    // Uses curl with silent and output flags
    assert.ok(
      content.includes("curl -s"),
      "verify_static_deployment must use curl -s for silent HTTP request"
    );

    // Checks for 200 status code
    assert.ok(
      content.includes("200") && content.includes("http_code"),
      "verify_static_deployment must check for HTTP 200 status code"
    );
  }
);

test(
  "Given deploy_static function, when checking error handling, then it returns 1 on sync failure",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // deploy_static checks sync_static_files exit code
    assert.ok(
      content.includes("sync_static_files || {"),
      "deploy_static must check sync_static_files exit status"
    );

    // Logs error on sync failure
    assert.ok(
      content.includes('log_error "Static deployment failed"') ||
      content.includes('log_error "File sync failed"'),
      "deploy_static must log error on sync failure"
    );

    // Returns 1 on failure
    const deployStaticMatch = content.match(
      /deploy_static\(\) \{[\s\S]*?^}/m
    );
    if (deployStaticMatch) {
      assert.ok(
        deployStaticMatch[0].includes("return 1"),
        "deploy_static must return 1 on failure"
      );
    }
  }
);

test(
  "Given deploy_static function, when checking error handling, then it returns 1 on verification failure",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Checks verify_static_deployment exit code
    assert.ok(
      content.includes("verify_static_deployment || {") ||
      content.includes("verify_static_deployment") && content.includes("return 1"),
      "deploy_static must check verify_static_deployment exit status"
    );

    // Logs error on verification failure
    assert.ok(
      content.includes('log_error "Verification failed"') ||
      content.includes('log_error "Deployment verification failed"'),
      "deploy_static must log error on verification failure"
    );
  }
);

test(
  "Given deploy_static function, when checking completion, then it logs elapsed time and shows deployment URL",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // Captures start time
    assert.ok(
      content.includes("start_time=$(date +%s)"),
      "deploy_static must capture start_time for elapsed time calculation"
    );

    // Logs elapsed time
    assert.ok(
      content.includes("log_elapsed_time"),
      "deploy_static must log elapsed time"
    );

    // Shows deployment URL if domain is set
    assert.ok(
      content.includes("${DEPLOY_DOMAIN}") &&
      content.includes("https://"),
      "deploy_static must show deployment URL using DEPLOY_DOMAIN"
    );

    // Success message
    assert.ok(
      content.includes("deployed successfully") || content.includes("DEPLOYMENT COMPLETE"),
      "deploy_static must log success message"
    );
  }
);

test(
  "Given deploy.sh main script, when checking --static mode, then it calls deploy_static",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // Sources deploy-static.sh
    assert.ok(
      content.includes('source "$SCRIPT_DIR/lib/deploy-static.sh"'),
      "deploy.sh must source deploy-static.sh library"
    );

    // Case handles static mode
    const caseBlock = content.match(/case "\$mode" in[\s\S]*?esac/);
    assert.ok(caseBlock, "deploy.sh must have case statement for mode");

    assert.ok(
      caseBlock[0].includes("static)") &&
      caseBlock[0].includes("deploy_static"),
      "deploy.sh must call deploy_static in static mode"
    );

    // Exits on deploy_static failure
    assert.ok(
      caseBlock[0].includes("deploy_static || exit 1"),
      "deploy.sh must exit with status 1 if deploy_static fails"
    );
  }
);

test(
  "Given deploy.sh main script, when checking default mode, then static is the default",
  () => {
    const content = readFile("deploy_scripts/deploy.sh");

    // determine_mode function exists
    assert.ok(
      content.includes("determine_mode()"),
      "deploy.sh must define determine_mode function"
    );

    // Returns 'static' as default
    const determineModeMatch = content.match(
      /determine_mode\(\) \{[\s\S]*?^}/m
    );
    assert.ok(determineModeMatch, "determine_mode function must exist");

    assert.ok(
      determineModeMatch[0].includes('echo "static"') &&
      determineModeMatch[0].includes("# Default"),
      "determine_mode must return 'static' as default"
    );
  }
);

// ─── CRITICAL: Static rsync must not delete portal-app/ ─────────────────────

test(
  "Given sync_static_files function, when rsync uses --delete, then it excludes portal-app/ to protect portal deployment",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");
    const funcMatch = content.match(
      /sync_static_files\(\) \{[\s\S]*?^}/m
    );
    assert.ok(funcMatch, "sync_static_files function must exist");
    const funcBody = funcMatch[0];

    // rsync --delete must exclude portal-app/ to prevent deleting
    // the portal application directory (including .env.local)
    assert.ok(
      funcBody.includes("--exclude='portal-app'") ||
      funcBody.includes('--exclude="portal-app"') ||
      funcBody.includes("--exclude=portal-app"),
      "sync_static_files rsync must exclude portal-app/ from --delete to protect portal deployment"
    );
  }
);
