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

### 4. Mixing --setup with Non-Interactive Mode

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

## Deployment Script Structure

**Entry point:** `deploy_scripts/deploy.sh`

**Function libraries:**
- `lib/output.sh` - Logging functions
- `lib/config.sh` - Configuration loading
- `lib/ssh.sh` - SSH connection helpers
- `lib/validation.sh` - Validation checks
- `lib/build.sh` - Build process
- `lib/deploy-static.sh` - Static site deployment
- `lib/deploy-portal.sh` - Portal deployment (credentials, database, admin)

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

**File:** `backend/config/vhost.txt` (lines 34-68 contain portal proxy configuration)

**Process:**
1. Edit `backend/config/vhost.txt` locally
2. Copy file contents to clipboard
3. Access ISP control panel vhost configuration page
4. Paste updated configuration
5. Save/apply in control panel

**Do NOT suggest:**
- SSH nginx commands (`nginx -t`, `systemctl reload nginx`, etc.)
- Direct editing of `/etc/nginx/` files
- Server-side nginx configuration changes

**Existing configuration includes:**
- Portal proxying (`/portal`, `/api/portal`, `/_next` → port 3000)
- Static site serving (root location `/`)
- SSL/HTTPS redirects
- Cache headers for static assets

**When suggesting nginx changes:**
1. Provide exact text for `backend/config/vhost.txt`
2. Highlight changed lines
3. Explain what to copy/paste in control panel
4. Reference line numbers for portal proxy section (34-68)

## Key Files Reference

- `deploy_scripts/deploy.sh` - Main deployment script
- `deploy_scripts/lib/deploy-portal.sh` - Portal-specific logic, credential handling
- `.deployrc.example` - Production configuration template
- `deploy_docs/DEPLOYMENT.md` - User-facing deployment guide
- `deploy_docs/UNIFIED_DEPLOYMENT.md` - Complete technical documentation
- `backend/config/vhost.txt` - Nginx configuration (deployed via ISP control panel)

## Token Count Optimization

This file: ~2200 tokens (before/after: N/A - new file)

**Placement rationale:** Standalone deployment patterns file (CLAUDE-DEPLOYMENT.md) keeps deployment-specific knowledge separate from main CLAUDE.md, reducing token load for non-deployment tasks.

**Cross-reference:** Added reference in CLAUDE.md deployment section.
