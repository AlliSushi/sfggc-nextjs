# CLAUDE-DEPLOYMENT.md

Deployment patterns and critical gotchas for AI agents assisting with deployment tasks.

## Deployment Script Architecture

**Unified Script:** `deploy_scripts/deploy.sh` handles static site, portal, or both.

**Critical Rule:** Run from project root, never from within `deploy_scripts/` (uses relative paths to `out/`).

## Flag Behavior and Critical Distinctions

### The --yes Flag (Deployment Confirmation)

**Purpose:** Skip deployment confirmation prompt ("Do you want to deploy?")

**Scope:** Only affects deployment confirmation, NOT credential prompts

**Usage:**
```bash
# Auto-confirm deployment, but credentials still prompt interactively
./deploy_scripts/deploy.sh --portal --yes
```

**When to use:**
- CI/CD pipelines (with environment variables for credentials)
- Scripted deployments
- Skipping "Press Y to continue" prompts

### The --setup Flag (Environment Reconfiguration)

**Purpose:** Force recreation of server `.env.local` file

**Behavior:**
- Deletes existing `.env.local` on server
- Prompts for ALL credentials interactively (or fails if non-interactive without env vars)
- Use cases: disaster recovery, broken config, credential rotation, server migration

**Usage:**
```bash
# Force environment reconfiguration
./deploy_scripts/deploy.sh --portal --setup --yes
```

**Critical:** `--setup` ALWAYS requires credential input (interactive OR env vars). Never runs silently.

### Flag Combinations

| Flags | Behavior |
|---|---|
| `--portal` | First-time: prompts for credentials. Subsequent: skips prompts (config exists) |
| `--portal --yes` | Auto-confirm deployment, credentials still prompt if needed |
| `--portal --setup` | Force reconfiguration, prompts for credentials, asks deployment confirmation |
| `--portal --setup --yes` | Force reconfiguration, prompts for credentials, auto-confirm deployment |

## Credential Handling: Interactive vs Non-Interactive

### Interactive Mode Detection

Script detects non-interactive mode with `[ ! -t 0 ]` (stdin is not a terminal).

**Non-interactive contexts:**
- Piped input: `echo "yes" | ./deploy.sh`
- Background jobs: `./deploy.sh &`
- CI/CD runners without TTY allocation
- Cron jobs

### Critical Bug Fixed (2026-02-09)

**Problem:** `read` commands with `--force` flag failed silently in non-interactive mode, creating empty credentials in `.env.local`.

**Root cause:** `read -sp` returns success even when no input provided in non-interactive mode.

**Symptom:** Database authentication failures, broken portal deployment, no visible errors during deployment.

**Fix:** Check `[ ! -t 0 ]` before prompting, fail fast with clear error message.

**Pattern enforced:**
```bash
# Get database password (from env var or prompt)
local DB_PASS="${DEPLOY_DB_PASSWORD:-}"
if [ -z "$DB_PASS" ]; then
  # Check if running interactively (stdin is a terminal)
  if [ ! -t 0 ]; then
    log_error "Database password required but not provided"
    log_error "Running in non-interactive mode (piped or background)"
    log_error ""
    log_error "Solution: Set environment variable:"
    log_error "  export DEPLOY_DB_PASSWORD='your_password'"
    return 1
  fi
  read -sp "  Database password: " DB_PASS
  echo ""
else
  log_info "Database password: (from DEPLOY_DB_PASSWORD env var)"
fi
```

**Rule:** All credential prompts MUST check for non-interactive mode before calling `read`.

## Non-Interactive Deployment (CI/CD)

**Required environment variables:**
```bash
export DEPLOY_DB_PASSWORD='...'          # Database password
export DEPLOY_SMTP_PASSWORD='...'        # SMTP password for email
export DEPLOY_ADMIN_EMAIL='...'          # Super admin email (first-time only)
export DEPLOY_ADMIN_NAME='...'           # Super admin name (first-time only)
export DEPLOY_ADMIN_PASSWORD='...'       # Super admin password (first-time only)
```

**Optional environment variables:**
```bash
export DEPLOY_SESSION_SECRET='...'       # Session secret (auto-generated if omitted)
export DEPLOY_PORTAL_BASE_URL='...'      # Portal base URL (defaults to https://$DOMAIN)
```

**CI/CD deployment pattern:**
```bash
# Set all required secrets
export DEPLOY_DB_PASSWORD="$SECRET_DB_PASSWORD"
export DEPLOY_SMTP_PASSWORD="$SECRET_SMTP_PASSWORD"

# Run deployment with auto-confirmation
./deploy_scripts/deploy.sh --portal --yes
```

**First-time CI/CD deployment:**
```bash
# Set all credentials including admin account
export DEPLOY_DB_PASSWORD="$SECRET_DB_PASSWORD"
export DEPLOY_SMTP_PASSWORD="$SECRET_SMTP_PASSWORD"
export DEPLOY_ADMIN_EMAIL="admin@example.com"
export DEPLOY_ADMIN_NAME="Admin User"
export DEPLOY_ADMIN_PASSWORD="$SECRET_ADMIN_PASSWORD"

# Run with auto-confirmation
./deploy_scripts/deploy.sh --portal --yes
```

## Common Deployment Patterns

### First-Time Portal Deployment (Interactive)

```bash
# Build and deploy portal with interactive prompts
npm run build
./deploy_scripts/deploy.sh --portal --yes
```

Prompts for:
- Database password (stored in server `.env.local`)
- SMTP password (stored in server `.env.local`)
- Admin email, name, password (stored in database)
- Session secret (auto-generated, or custom)

### Subsequent Portal Deployments

```bash
# Code changes only, no credential prompts
npm run build
./deploy_scripts/deploy.sh --portal --yes
```

Skips credential prompts (`.env.local` exists, admin account exists).

### Environment Reconfiguration (Disaster Recovery)

**Scenarios:**
- Broken `.env.local` file (wrong password, missing values)
- Credential rotation (new database password)
- Server migration (different database host)

```bash
# Force environment reconfiguration
./deploy_scripts/deploy.sh --portal --setup --yes
```

Recreates `.env.local` from scratch, prompts for ALL credentials.

### Full Deployment (Static + Portal)

```bash
# Deploy everything
npm run build
./deploy_scripts/deploy.sh --all --yes
```

### Dry Run (Preview Without Executing)

```bash
# See what would happen
./deploy_scripts/deploy.sh --portal --dry-run

# See detailed output
./deploy_scripts/deploy.sh --all --dry-run --verbose
```

## Critical Deployment Gotchas

### 1. Silent Credential Failures

**Symptom:** Deployment succeeds but portal fails with database auth errors.

**Cause:** Non-interactive mode with missing environment variables.

**Detection:** Check `.env.local` on server for empty values:
```bash
ssh user@server "cat /path/to/portal/.env.local"
```

**Fix:** Provide credentials via environment variables OR run interactively.

### 2. Using --force Instead of --yes

**Legacy issue:** Old documentation referenced `--force` flag.

**Current:** Use `--yes` or `-y` for deployment confirmation.

**Note:** `--force` is aliased to `--yes` for backward compatibility, but `--yes` is preferred.

### 3. Running from Wrong Directory

**Error:** `out/` directory not found.

**Cause:** Running deployment script from within `deploy_scripts/`.

**Fix:** Always run from project root:
```bash
cd /path/to/project
./deploy_scripts/deploy.sh --portal
```

### 4. Static Rsync --delete Destroys Portal Directory

**Symptom:** Every `--all` deploy triggers "First-time portal deployment detected."

**Cause:** Static rsync uses `--delete` to sync `out/` to web root. `portal-app/` doesn't exist in `out/`, so rsync deletes it — including `.env.local`.

**Fix applied:** `--exclude='portal-app'` added to static rsync in `deploy-static.sh`.

**Rule:** When rsync `--delete` targets a directory containing subdirectories managed by other deploy steps, those subdirectories MUST be excluded.

### 5. SSH Stdin Consumption Skips Migrations

**Symptom:** Only 1 of N migrations runs during portal deployment.

**Cause:** `ssh` without `-n` reads from stdin. Inside `while read` loops, the first `ssh` call consumes remaining stdin.

**Fix applied:** `ssh -n` in `ssh_command()` function (`lib/ssh.sh`).

**Rule:** Always use `ssh -n` for non-interactive remote commands, especially inside loops.

### 6. Mixing --setup with Non-Interactive Mode

**Error:** Script fails with "Database password required but not provided".

**Cause:** `--setup` forces credential prompts, but running in non-interactive mode.

**Fix:** Provide ALL credentials via environment variables when using `--setup` in CI/CD.

## Agent Guidance: Helping Users with Deployment

### Diagnostic Questions

When user reports deployment issues, ask:

1. **First-time or subsequent deployment?**
   - First-time: Credentials required
   - Subsequent: Should skip credential prompts

2. **Running interactively or in CI/CD?**
   - Interactive: Prompts work
   - CI/CD: Requires environment variables

3. **Using --setup flag?**
   - Without: Preserves existing `.env.local`
   - With: Forces credential re-entry

4. **Portal working after deployment?**
   - Yes: Deployment succeeded
   - No: Check `.env.local` for empty credentials

### Troubleshooting Workflow

**Portal fails after deployment:**

1. Check `.env.local` on server:
```bash
ssh user@server "cat /path/to/portal/.env.local | grep -E '(DATABASE_URL|SMTP)'"
```

2. Look for empty values or malformed URLs.

3. If credentials missing:
```bash
# Interactive fix
./deploy_scripts/deploy.sh --portal --setup --yes

# CI/CD fix
export DEPLOY_DB_PASSWORD="correct_password"
export DEPLOY_SMTP_PASSWORD="correct_password"
./deploy_scripts/deploy.sh --portal --setup --yes
```

**Database connection fails:**

Check database password in `.env.local`, verify database user exists, test connection from server:
```bash
ssh user@server "cd /path/to/portal && node -e \"const db = require('./src/utils/portal/db.js'); db.getConnection().then(() => console.log('OK')).catch(e => console.error(e.message))\""
```

**SMTP fails (magic links not sending):**

Check SMTP credentials in `.env.local`, verify SMTP host/port, test connection:
```bash
ssh user@server "cd /path/to/portal && node backend/scripts/test-smtp.sh"
```

## SSH Inline Node.js Scripts

When running `node -e` via SSH that reads `.env.local`:

**Problem:** `.env.local` uses plain assignment (`KEY=value`, no `export`), so `source` alone does not export vars to child processes like `node`.

**Pattern:**
```bash
ssh_command "cd $PORTAL_PATH && set -a && source .env.local 2>/dev/null && set +a && node -e \"
    const db = require('./src/utils/portal/db.js');
    // ... script
\""
```

**Rules:**
1. `set -a` before `source`, `set +a` after -- auto-exports all sourced variables
2. Avoid `!` operator in inline scripts -- SSH layers escape it to `\!`. Use `=== ''` or `=== undefined` instead
3. Wrap `node -e` script in escaped double quotes inside the SSH command string
4. Always `2>/dev/null` on source to suppress missing-file warnings in dry-run

**Deploy verification example (check admin account exists):**
```bash
ssh_command "cd $PATH && set -a && source .env.local 2>/dev/null && set +a && node -e \"
    const { query, closePool } = require('./src/utils/portal/db.js');
    query('SELECT COUNT(*) as count FROM admins WHERE role = ?', ['super-admin'])
      .then(([rows]) => { console.log(rows[0].count > 0 ? 'EXISTS' : 'MISSING'); })
      .finally(() => closePool());
\""
```

## Image Optimization in Deploy Pipeline

**Problem:** `next.config.js` sets `images: { unoptimized: true }` for static export, so Next.js does not optimize images. Oversized source images ship at full resolution, increasing page load times.

**Solution:** `deploy_scripts/lib/optimize-images.sh` auto-resizes images wider than `MAX_IMAGE_WIDTH=800` using macOS `sips` (no external dependencies).

**Pipeline integration:** Called from `build_static()` in `build.sh` **before** `npm run build`:
```
build_static() → optimize_images() → npm run build
```

**Key details:**
- Uses `sips --resampleWidth 800` for resizing (macOS built-in)
- `get_file_size()` helper: cross-platform (`stat -f%z` macOS, `stat -c%s` Linux)
- Respects `DRY_RUN` flag (logs what would change without modifying files)
- Scans `src/images/` recursively for `.jpg`, `.jpeg`, `.png` files
- Modifies source files in place (git tracks the change)

**Test:** `tests/unit/optimize-images.test.js` (9 BDD tests including dry-run, recursive, mixed-size scenarios)

## Server-Mode Config Template

**Problem:** Three places generated `next.config.js` for server mode using inline heredocs. Template drift caused production incident where `compress: false` was missing from some templates.

**Solution:** Extracted shared `write_server_mode_config()` function in `deploy_scripts/lib/build.sh`. Both `build_portal_local()` and `ensure_server_mode_config()` call this single function.

**Note:** `deploy_scripts/lib/deploy-portal.sh` has a third instance that writes via SSH to the remote server -- left as inline heredoc since it cannot call the local function.

**Rule:** When modifying the server-mode `next.config.js` template, update `write_server_mode_config()` in `build.sh`. Verify the remote template in `deploy-portal.sh` matches.

**Test:** `tests/unit/deployment/config-management.test.js`

## Deployment Script Structure

**Entry point:** `deploy_scripts/deploy.sh`

**Function libraries:**
- `lib/output.sh` - Logging functions
- `lib/config.sh` - Configuration loading
- `lib/ssh.sh` - SSH connection helpers
- `lib/validation.sh` - Validation checks
- `lib/build.sh` - Build process (`write_server_mode_config()` single source of truth)
- `lib/optimize-images.sh` - Pre-build image resizing (macOS `sips`, `MAX_IMAGE_WIDTH=800`)
- `lib/deploy-static.sh` - Static site deployment (rsync with `--exclude='portal-app'`)
- `lib/deploy-portal.sh` - Portal deployment (credentials, database, admin)
- `lib/deploy-migrations.sh` - Database migration runner (depends on `ssh -n` in ssh.sh)

**Credential prompts (all in `lib/deploy-portal.sh`):**
- Line 99: Database password (`read -sp`)
- Line 125: SMTP password (`read -sp`)
- Line 233: Admin email (`read -p`)
- Line 244: Admin name (`read -p`)
- Line 255: Admin password (`read -sp`)

**Each prompt checks `[ ! -t 0 ]` before calling `read`.**

## Server Configuration: Nginx Management

**Critical:** User does NOT have direct nginx access. All nginx configuration changes MUST follow this workflow.

### Nginx Configuration Workflow

**File:** `backend/config/vhost.txt`

**Process:**
1. Edit `backend/config/vhost.txt` locally
2. Copy to clipboard: `cat backend/config/vhost.txt | pbcopy`
3. Log into CloudPanel ISP portal → nginx/vhost configuration
4. Paste entire contents and save (panel validates and reloads nginx)

**Do NOT suggest:**
- SSH nginx commands (`nginx -t`, `systemctl reload nginx`, etc.)
- Direct editing of `/etc/nginx/` files
- Server-side nginx configuration changes

### Nginx ^~ Modifier Requirement

**CRITICAL:** All portal proxy prefix locations MUST use `^~` modifier.

**Why:** Nginx regex `location ~* \.(js|css|...)$` overrides plain prefix locations. Without `^~`, `/_next/static/*.js` matches the static asset regex instead of the proxy block, returning 404 for all JS bundles. This breaks React hydration entirely -- client-side JS never loads, `useEffect`/`useAdminSession` never run, interactive features are invisible.

**Required pattern in `backend/config/vhost.txt`:**
```nginx
location ^~ /portal { proxy_pass ...; }
location ^~ /api/portal { proxy_pass ...; }
location ^~ /_next/static { alias ...; }
location ^~ /_next { proxy_pass ...; }
```

**Nginx location priority (highest to lowest):**

| Type | Example | Behavior |
|---|---|---|
| `= /path` | Exact match | Checked first |
| `^~ /prefix` | Prefix, suppresses regex | Checked second, stops regex check |
| `~* \.js$` | Regex (case-insensitive) | Checked third, overrides plain prefix |
| `/prefix` | Plain prefix | Lowest priority |

### Nginx Upstream Keepalive

Use `upstream` block with `keepalive` for persistent connections to Node.js (saves 20-50ms TCP handshake per request):

```nginx
upstream portal_backend {
  server 127.0.0.1:3000;
  keepalive 16;
}
```

**Required proxy headers for keepalive:**
- `proxy_http_version 1.1;`
- `proxy_set_header Connection "";` (NOT `"upgrade"` -- that forces per-request upgrade and defeats keepalive)

### Nginx try_files Ordering and Trailing Slash Rewrite

**Problem:** Static pages that share a name with a directory (e.g., `results.html` and `results/` containing PDFs) return 403 Forbidden. Nginx finds the directory before the `.html` file and tries to serve a directory listing, which is denied.

**Fix (in `backend/config/vhost.txt`):**
```nginx
location / {
    # Strip trailing slash — /results/ becomes /results, preventing 403
    # on directories that collide with static page names
    rewrite ^/(.+)/$ /$1 permanent;

    # Check .html BEFORE directory to serve results.html instead of results/
    try_files $uri $uri.html $uri/ /index.html;
}
```

**Two rules work together:**

| Rule | Purpose |
|---|---|
| `rewrite ^/(.+)/$ /$1 permanent` | Strips trailing slash (`/results/` → `/results`) so the `.html` check can match |
| `$uri.html` before `$uri/` in try_files | Serves `results.html` instead of attempting directory listing on `results/` |

**Why both are needed:** Without the rewrite, a cached or manually-typed `/results/` bypasses the try_files `.html` check (there's no `/results/.html`). Without the try_files reorder, `/results` without trailing slash would still try the directory first.

**Safe for PDFs:** Direct file requests like `/results/2024/team.pdf` match `$uri` as a regular file and are served immediately.

### Nginx Gzip and next.config.js

When nginx handles gzip compression, set `compress: false` in `next.config.js` to avoid double-compression. Current config already does this -- do not re-enable.

**When suggesting nginx changes:**
1. Provide exact text for `backend/config/vhost.txt`
2. Highlight changed lines
3. Explain what to copy/paste in control panel

## Key Files Reference

- `deploy_scripts/deploy.sh` - Main deployment script
- `deploy_scripts/lib/build.sh` - Build orchestration, `write_server_mode_config()` template
- `deploy_scripts/lib/optimize-images.sh` - Pre-build image resizing
- `deploy_scripts/lib/deploy-portal.sh` - Portal-specific logic, credential handling
- `.deployrc.example` - Production configuration template
- `deploy_docs/DEPLOYMENT.md` - User-facing deployment guide
- `deploy_docs/UNIFIED_DEPLOYMENT.md` - Complete technical documentation
- `backend/config/vhost.txt` - Nginx configuration (deployed via ISP control panel)

## Token Count Optimization

This file: ~2200 tokens (before/after: N/A - new file)

**Placement rationale:** Standalone deployment patterns file (CLAUDE-DEPLOYMENT.md) keeps deployment-specific knowledge separate from main CLAUDE.md, reducing token load for non-deployment tasks.

**Cross-reference:** Added reference in CLAUDE.md deployment section.
