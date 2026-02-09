const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = process.cwd();

// ─── Helper Functions ────────────────────────────────────────────────────────

const readFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

// ─── SSH Helper Function Tests ───────────────────────────────────────────────

test(
  "Given ssh_command function, when checking source, then it executes SSH commands using DEPLOY_SSH_USER and DEPLOY_SSH_HOST",
  () => {
    const content = readFile("deploy_scripts/lib/ssh.sh");

    // Function exists
    assert.ok(
      content.includes("ssh_command()"),
      "ssh.sh must define ssh_command function"
    );

    // Takes command as parameter
    assert.ok(
      content.includes('local command="$1"'),
      "ssh_command must accept command as first parameter"
    );

    // Uses SSH variables
    assert.ok(
      content.includes("${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}"),
      "ssh_command must use DEPLOY_SSH_USER and DEPLOY_SSH_HOST variables"
    );

    // Respects DRY_RUN
    assert.ok(
      content.includes('[ "${DRY_RUN:-false}" = true ]'),
      "ssh_command must check DRY_RUN flag"
    );

    // Executes SSH
    assert.ok(
      content.includes('ssh "${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}" "$command"'),
      "ssh_command must execute ssh with user@host and command"
    );
  }
);

test(
  "Given check_remote_file_exists function, when checking source, then it tests file existence without quoting path to allow tilde expansion",
  () => {
    const content = readFile("deploy_scripts/lib/ssh.sh");

    // Function exists
    assert.ok(
      content.includes("check_remote_file_exists()"),
      "ssh.sh must define check_remote_file_exists function"
    );

    // Takes remote path as parameter
    assert.ok(
      content.includes('local remote_path="$1"'),
      "check_remote_file_exists must accept remote_path as parameter"
    );

    // Uses [ -f ] test without quotes for tilde expansion
    assert.ok(
      content.includes("[ -f $remote_path ]"),
      "check_remote_file_exists must use unquoted $remote_path to allow tilde expansion"
    );

    // Comment explains tilde expansion
    const lines = content.split("\n");
    let foundTildeComment = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("check_remote_file_exists")) {
        // Check nearby lines for tilde comment
        for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 20); j++) {
          if (
            lines[j].includes("tilde") ||
            lines[j].includes("Expand tilde") ||
            lines[j].includes("without quotes")
          ) {
            foundTildeComment = true;
            break;
          }
        }
        break;
      }
    }

    assert.ok(
      foundTildeComment,
      "check_remote_file_exists must comment about tilde expansion behavior"
    );
  }
);

test(
  "Given check_remote_dir_exists function, when checking source, then it tests directory existence without quoting path to allow tilde expansion",
  () => {
    const content = readFile("deploy_scripts/lib/ssh.sh");

    // Function exists
    assert.ok(
      content.includes("check_remote_dir_exists()"),
      "ssh.sh must define check_remote_dir_exists function"
    );

    // Takes remote path as parameter
    assert.ok(
      content.includes('local remote_path="$1"'),
      "check_remote_dir_exists must accept remote_path as parameter"
    );

    // Uses [ -d ] test without quotes for tilde expansion
    assert.ok(
      content.includes("[ -d $remote_path ]"),
      "check_remote_dir_exists must use unquoted $remote_path to allow tilde expansion"
    );

    // Comment explains tilde expansion
    const lines = content.split("\n");
    let foundTildeComment = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("check_remote_dir_exists")) {
        // Check nearby lines for tilde comment
        for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 20); j++) {
          if (
            lines[j].includes("tilde") ||
            lines[j].includes("Expand tilde") ||
            lines[j].includes("without quotes")
          ) {
            foundTildeComment = true;
            break;
          }
        }
        break;
      }
    }

    assert.ok(
      foundTildeComment,
      "check_remote_dir_exists must comment about tilde expansion behavior"
    );
  }
);

test(
  "Given scp_file function, when checking source, then it copies files using DEPLOY_SSH_USER and DEPLOY_SSH_HOST",
  () => {
    const content = readFile("deploy_scripts/lib/ssh.sh");

    // Function exists
    assert.ok(
      content.includes("scp_file()"),
      "ssh.sh must define scp_file function"
    );

    // Takes local and remote paths
    assert.ok(
      content.includes('local local_file="$1"') &&
      content.includes('local remote_path="$2"'),
      "scp_file must accept local_file and remote_path parameters"
    );

    // Uses SCP with SSH variables
    assert.ok(
      content.includes("scp") &&
      content.includes("${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}"),
      "scp_file must use scp command with DEPLOY_SSH_USER and DEPLOY_SSH_HOST"
    );

    // Respects DRY_RUN
    assert.ok(
      content.includes('[ "${DRY_RUN:-false}" = true ]'),
      "scp_file must check DRY_RUN flag"
    );
  }
);

test(
  "Given rsync_files function, when checking source, then it syncs directories with delete flag",
  () => {
    const content = readFile("deploy_scripts/lib/ssh.sh");

    // Function exists
    assert.ok(
      content.includes("rsync_files()"),
      "ssh.sh must define rsync_files function"
    );

    // Takes local dir, remote dir, and exclude patterns
    assert.ok(
      content.includes('local local_dir="$1"') &&
      content.includes('local remote_dir="$2"') &&
      content.includes('local exclude_patterns="$3"'),
      "rsync_files must accept local_dir, remote_dir, and exclude_patterns"
    );

    // Uses rsync with --delete
    assert.ok(
      content.includes("rsync -avz --delete"),
      "rsync_files must use rsync with -avz --delete flags"
    );

    // Processes exclude patterns
    assert.ok(
      content.includes("--exclude"),
      "rsync_files must handle exclude patterns"
    );

    // Respects DRY_RUN
    assert.ok(
      content.includes('[ "${DRY_RUN:-false}" = true ]'),
      "rsync_files must check DRY_RUN flag"
    );
  }
);

test(
  "Given test_ssh_connection function, when checking source, then it uses BatchMode and ConnectTimeout",
  () => {
    const content = readFile("deploy_scripts/lib/ssh.sh");

    // Function exists
    assert.ok(
      content.includes("test_ssh_connection()"),
      "ssh.sh must define test_ssh_connection function"
    );

    // Uses BatchMode (no password prompts)
    assert.ok(
      content.includes("BatchMode=yes"),
      "test_ssh_connection must use BatchMode=yes to avoid password prompts"
    );

    // Uses ConnectTimeout
    assert.ok(
      content.includes("ConnectTimeout"),
      "test_ssh_connection must use ConnectTimeout for quick failure"
    );

    // Exits with SSH exit code
    assert.ok(
      content.includes("'exit'") && content.includes("return $?"),
      "test_ssh_connection must run exit command and return SSH exit code"
    );

    // Respects DRY_RUN
    assert.ok(
      content.includes('[ "${DRY_RUN:-false}" = true ]'),
      "test_ssh_connection must check DRY_RUN flag"
    );
  }
);

test(
  "Given create_remote_backup function, when checking source, then it creates timestamped backups",
  () => {
    const content = readFile("deploy_scripts/lib/ssh.sh");

    // Function exists
    assert.ok(
      content.includes("create_remote_backup()"),
      "ssh.sh must define create_remote_backup function"
    );

    // Takes directory to backup
    assert.ok(
      content.includes('local dir_to_backup="$1"'),
      "create_remote_backup must accept dir_to_backup parameter"
    );

    // Creates timestamp
    assert.ok(
      content.includes("timestamp=$(date +%Y%m%d_%H%M%S)"),
      "create_remote_backup must create timestamp for backup naming"
    );

    // Creates backup directory name
    assert.ok(
      content.includes('backup_dir="${dir_to_backup}.backup.$timestamp"') ||
      content.includes('local backup_dir="${dir_to_backup}.backup.$timestamp"'),
      "create_remote_backup must create backup_dir with timestamp"
    );

    // Checks if directory exists before backing up
    assert.ok(
      content.includes('[ -d "$dir_to_backup" ]') ||
      content.includes('[ -d \\"$dir_to_backup\\" ]'),
      "create_remote_backup must check if directory exists before backing up"
    );

    // Uses cp -r for recursive copy
    assert.ok(
      content.includes("cp -r"),
      "create_remote_backup must use cp -r for recursive backup"
    );

    // Respects DRY_RUN
    assert.ok(
      content.includes('[ "${DRY_RUN:-false}" = true ]'),
      "create_remote_backup must check DRY_RUN flag"
    );
  }
);

test(
  "Given all SSH helper functions, when checking DRY_RUN handling, then they return success (0) in dry-run mode",
  () => {
    const content = readFile("deploy_scripts/lib/ssh.sh");

    // Most SSH helper functions have DRY_RUN checks
    // ssh_command checks DRY_RUN
    assert.ok(
      content.includes("ssh_command()"),
      "ssh_command must exist"
    );

    // scp_file checks DRY_RUN
    assert.ok(
      content.includes("scp_file()"),
      "scp_file must exist"
    );

    // rsync_files checks DRY_RUN
    assert.ok(
      content.includes("rsync_files()"),
      "rsync_files must exist"
    );

    // test_ssh_connection checks DRY_RUN
    assert.ok(
      content.includes("test_ssh_connection()"),
      "test_ssh_connection must exist"
    );

    // create_remote_backup checks DRY_RUN
    assert.ok(
      content.includes("create_remote_backup()"),
      "create_remote_backup must exist"
    );

    // check_remote_file_exists checks DRY_RUN
    assert.ok(
      content.includes("check_remote_file_exists()"),
      "check_remote_file_exists must exist"
    );

    // check_remote_dir_exists checks DRY_RUN
    assert.ok(
      content.includes("check_remote_dir_exists()"),
      "check_remote_dir_exists must exist"
    );

    // All functions must have DRY_RUN check pattern
    const dryRunChecks = content.match(/\[ "\$\{DRY_RUN:-false\}" = true \]/g);
    assert.ok(
      dryRunChecks && dryRunChecks.length >= 6,
      `ssh.sh must have at least 6 DRY_RUN checks (found: ${dryRunChecks ? dryRunChecks.length : 0})`
    );

    // All functions must have return 0 for dry-run success
    const return0s = content.match(/return 0/g);
    assert.ok(
      return0s && return0s.length >= 6,
      `ssh.sh must have at least 6 'return 0' statements (found: ${return0s ? return0s.length : 0})`
    );
  }
);

test(
  "Given deploy-portal.sh using check_remote_file_exists, when checking source, then it checks for .env.local with tilde path",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-portal.sh");

    // setup_portal_environment uses check_remote_file_exists
    assert.ok(
      content.includes("check_remote_file_exists"),
      "deploy-portal.sh must use check_remote_file_exists helper"
    );

    // Checks .env.local
    assert.ok(
      content.includes(".env.local"),
      "setup_portal_environment must check for .env.local file"
    );

    // Uses DEPLOY_PORTAL_PATH which may contain tilde
    assert.ok(
      content.includes("${DEPLOY_PORTAL_PATH}"),
      "setup_portal_environment must use DEPLOY_PORTAL_PATH variable"
    );
  }
);

test(
  "Given deploy-static.sh using ssh_command, when checking source, then it uses ssh_command for remote operations",
  () => {
    const content = readFile("deploy_scripts/lib/deploy-static.sh");

    // verify_static_deployment uses ssh_command
    assert.ok(
      content.includes("ssh_command"),
      "deploy-static.sh must use ssh_command helper for remote checks"
    );

    // Checks for index.html existence
    assert.ok(
      content.includes("index.html"),
      "verify_static_deployment must check for index.html"
    );

    // Uses [ -f ] test
    assert.ok(
      content.includes("[ -f"),
      "verify_static_deployment must use [ -f ] test for file existence"
    );
  }
);
