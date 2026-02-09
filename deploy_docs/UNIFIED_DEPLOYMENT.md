# Unified Deployment Guide

This guide covers the unified deployment system for the SFGGC Next.js project, which supports deploying the static site, portal application, or both.

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment Modes](#deployment-modes)
- [First-Time Portal Deployment](#first-time-portal-deployment)
- [Dry-Run Mode](#dry-run-mode)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)

---

## Quick Start

### Prerequisites

- Node.js and npm installed locally
- SSH access to production server configured
- For portal: Database credentials (AWS RDS) and SMTP password (AWS SES)

### Basic Usage

```bash
# 1. Deploy static site (default)
./deploy_scripts/deploy.sh

# 2. Deploy portal application
./deploy_scripts/deploy.sh --portal

# 3. Deploy everything
./deploy_scripts/deploy.sh --all

# 4. Non-interactive deployment (for CI/CD)
export DEPLOY_DB_PASSWORD="secret" DEPLOY_SMTP_PASSWORD="secret"
./deploy_scripts/deploy.sh --portal  # No prompts!
```

**Note:** First-time portal deployments prompt for secrets (database password, SMTP password, admin account). See [Non-Interactive Mode](#non-interactive-mode-optional---for-automationci-cd) for automation via environment variables.

---

## Configuration

### Default Configuration (No Setup Required!)

The deployment script uses `.deployrc.example` automatically, which contains correct production values. **You typically don't need to create a custom configuration file.**

### Custom Configuration (Optional)

Only create a custom `.deployrc` if you need different values (e.g., staging server, different paths):

1. **Copy the example configuration:**
   ```bash
   cp .deployrc.example .deployrc
   ```

2. **Edit `.deployrc` with your values:**
   ```bash
   nano .deployrc  # or vim, code, etc.
   ```

3. **Secure the file:**
   ```bash
   chmod 600 .deployrc
   ```

The script will automatically use `.deployrc` if it exists, otherwise falls back to `.deployrc.example`.

### Configuration Options

**IMPORTANT:** Configuration files contain ONLY non-secret infrastructure settings. Secrets (passwords, credentials) are collected interactively during deployment and stored on the server, never in local config files.

#### SSH Configuration
```bash
DEPLOY_SSH_USER="goldengateclassic"       # SSH username
DEPLOY_SSH_HOST="54.70.1.215"             # Server IP or hostname
DEPLOY_DOMAIN="www.goldengateclassic.org" # Your domain
```

#### Static Site Deployment
```bash
DEPLOY_STATIC_PATH="/home/goldengateclassic/htdocs/www.goldengateclassic.org"
```

#### Portal Application Deployment
```bash
DEPLOY_PORTAL_PATH="~/htdocs/www.goldengateclassic.org/portal-app"
DEPLOY_PM2_APP_NAME="sfggc-portal"
```

#### Database Configuration (Portal Only) - NON-SECRET
```bash
DEPLOY_DB_HOST="shared2.cdms8mviovca.us-west-2.rds.amazonaws.com"
DEPLOY_DB_PORT="3306"
DEPLOY_DB_NAME="goldengate"
DEPLOY_DB_USER="goldengate"  # Username (non-secret, always the same)
```

**Note:** Database password is NOT in `.deployrc`. It is prompted interactively during first portal deployment and stored in `.env.local` on the server only.

#### SMTP Configuration (Portal Only) - NON-SECRET
```bash
DEPLOY_SMTP_HOST="email-smtp.us-west-2.amazonaws.com"
DEPLOY_SMTP_PORT="587"
DEPLOY_SMTP_USER="AKIAVU7WKXGTZZA3SOHN"
DEPLOY_SMTP_FROM="Golden Gate Classic <noreply@goldengateclassic.org>"
```

**Note:** SMTP password is NOT in `.deployrc`. It is prompted interactively during first portal deployment and stored in `.env.local` on the server only.

---

## Deployment Modes

### Static Site Only (Default)

Deploys the public-facing website (7 static pages).

```bash
./deploy_scripts/deploy.sh
# or explicitly:
./deploy_scripts/deploy.sh --static
```

**What it does:**
1. Builds static site (`npm run build` with `output: 'export'`)
2. Creates backup of existing deployment on server
3. Syncs files via rsync with `--delete` flag
4. Generates `.htaccess` for Apache optimization
5. Verifies deployment

**Requirements:**
- `out/` directory with built static files (auto-built if missing)

### Portal Application Only

Deploys the server-rendered portal system.

```bash
./deploy_scripts/deploy.sh --portal
```

**What it does:**
1. Syncs application files (excluding node_modules, .git, .env)
2. Installs dependencies on server (`npm install --production`)
3. First-time only: Interactive setup for `.env.local`
4. Initializes database schema (idempotent)
5. First-time only: Creates super admin account
6. Builds application on server (`npm run build`)
7. Manages PM2 process (install/start/restart)
8. Configures PM2 auto-restart on reboot
9. Verifies deployment

**Requirements:**
- Database credentials (prompted on first deployment)
- SMTP password (prompted on first deployment)

### Both Static and Portal

Deploys everything in sequence.

```bash
./deploy_scripts/deploy.sh --all
```

**What it does:**
- Runs static deployment first
- Then runs portal deployment
- Reports status for both

---

## First-Time Portal Deployment

The first time you deploy the portal, the script will prompt for sensitive information.

### Interactive Prompts (Default)

```
Database Configuration:
ℹ Database username: goldengate (from config)
  Database password: ********

  Admin session secret [auto-generated]: (press Enter to accept)
  SMTP password (AWS SES): ********
  Portal base URL [https://www.goldengateclassic.org]: (press Enter to accept)

No admin accounts found. Let's create a super admin.
  Admin email: admin@goldengateclassic.org
  Admin full name: Admin User
  Admin password: ********
```

### Non-Interactive Mode (Optional - For Automation/CI-CD)

For automation or CI/CD pipelines, you can provide secrets via environment variables instead of interactive prompts:

**Portal Environment Secrets:**
```bash
export DEPLOY_DB_PASSWORD="your-database-password"
export DEPLOY_SMTP_PASSWORD="your-aws-ses-smtp-password"

# Optional (auto-generated/defaulted if not provided):
export DEPLOY_SESSION_SECRET="64-char-hex-string"  # Random if not set
export DEPLOY_PORTAL_BASE_URL="https://your-domain"  # Defaults to $DEPLOY_DOMAIN
```

**Admin Account Creation:**
```bash
export DEPLOY_ADMIN_EMAIL="admin@goldengateclassic.org"
export DEPLOY_ADMIN_NAME="Tournament Administrator"
export DEPLOY_ADMIN_PASSWORD="SecurePassword123!"
```

**Example - Non-Interactive First Deployment:**
```bash
# Set secrets via environment variables
export DEPLOY_DB_PASSWORD="prod-db-password"
export DEPLOY_SMTP_PASSWORD="aws-ses-smtp-password"
export DEPLOY_ADMIN_EMAIL="admin@goldengateclassic.org"
export DEPLOY_ADMIN_NAME="John Doe"
export DEPLOY_ADMIN_PASSWORD="AdminSecurePass!"

# Deploy portal (no prompts!)
./deploy_scripts/deploy.sh --portal
```

**How It Works:**
- If environment variables are set, the script uses them silently
- If not set, the script prompts interactively (default behavior)
- Mix and match: set some via env vars, prompt for others
- After first deployment, subsequent deployments don't need secrets (config/admins already exist)

**CI/CD Example (GitHub Actions):**
```yaml
- name: Deploy Portal
  env:
    DEPLOY_DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    DEPLOY_SMTP_PASSWORD: ${{ secrets.SMTP_PASSWORD }}
    DEPLOY_ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
    DEPLOY_ADMIN_NAME: ${{ secrets.ADMIN_NAME }}
    DEPLOY_ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
  run: |
    ./deploy_scripts/deploy.sh --portal
```

### What Gets Created

1. **`.env.local` on server** with:
   - `PORTAL_DATABASE_URL` (includes username and password from your prompts)
   - `ADMIN_SESSION_SECRET` (auto-generated 32-byte hex string)
   - `PORTAL_BASE_URL`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (password from your prompt)
   - `SMTP_FROM`

2. **Database schema** (11 tables):
   - `admins`, `people`, `teams`, `doubles_pairs`, `scores`
   - `audit_logs`, `participant_login_tokens`, `admin_password_resets`
   - `admin_actions`, `email_templates`

3. **Super admin account** in database:
   - Email, name, and hashed password (bcrypt)
   - Role: `super-admin`

### Where Secrets Are Stored

**IMPORTANT - Security Model:**

- **Local machine (`.deployrc`)**: Contains ONLY non-secret config (hosts, ports, paths)
- **Server (`.env.local`)**: Contains secrets (database password, SMTP password, session secret)
- **Database**: Contains admin account with hashed password (bcrypt)
- **Your terminal**: Secrets visible only during interactive prompts, never logged

**Secrets flow:**
1. You type them during deployment (visible in terminal briefly)
2. Script sends them securely via SSH to server
3. Script writes them to `.env.local` on server
4. Secrets never touch your local filesystem in any config file

This design keeps secrets secure - they're only on the production server where they're needed.

### Subsequent Deployments

After first-time setup, the script will:
- Skip environment configuration (`.env.local` exists)
- Skip database initialization (schema exists)
- Skip admin creation (admins exist)
- Just sync code, install dependencies, build, and restart PM2

---

## Dry-Run Mode

Preview what will happen without making changes.

### Basic Dry-Run

```bash
./deploy_scripts/deploy.sh --dry-run
```

**Output:**
```
=== DEPLOYMENT PLAN ===
Mode: Static Site
Server: goldengateclassic@54.70.1.215
Path: /home/goldengateclassic/htdocs/www.goldengateclassic.org

⚠ DRY RUN MODE - No actual changes will be made

=== STATIC SITE DEPLOYMENT ===
○ Would create backup of existing files
○ Would sync out/ to /home/goldengateclassic/...
○ Would create .htaccess on server
○ Would verify deployment
✓ Static site deployed successfully!
```

### Verbose Dry-Run

Shows commands that would be executed.

```bash
./deploy_scripts/deploy.sh --portal --dry-run --verbose
```

**Output:**
```
○ Would sync project files to ~/htdocs/...
  Excludes: node_modules, .git, .next, out, .env*
○ Would run: npm install --production
○ Would prompt for database credentials
○ Would run: bash scripts/dev/init-portal-db.sh
...
```

### Debug Dry-Run

Shows full environment and debugging information.

```bash
./deploy_scripts/deploy.sh --all --dry-run --debug
```

**Output includes:**
- All configuration variables
- Full command traces
- Working directories
- User context

---

## Troubleshooting

### SSH Connection Failed

**Error:**
```
✗ SSH connection failed to goldengateclassic@54.70.1.215
```

**Solution:**
```bash
# Set up SSH key authentication
./deploy_scripts/setup-ssh.sh goldengateclassic@54.70.1.215 sfggc

# Test connection manually
ssh goldengateclassic@54.70.1.215 'echo OK'
```

### Build Failed

**Error:**
```
✗ Build failed
```

**Solution:**
```bash
# Test build locally first
npm run build

# Check for syntax errors
npm run lint

# Ensure dependencies are installed
npm install
```

### Portal Won't Start (PM2 Issues)

**Error:**
```
✗ PM2 process is not running
```

**Solution:**
```bash
# SSH to server and check PM2 logs
ssh goldengateclassic@54.70.1.215
pm2 logs sfggc-portal

# Common issues:
# - Database connection error: Check .env.local credentials
# - Port already in use: Check for other processes on port 3000
# - Build errors: Check npm run build output
```

### Portal HTTP 502 Error

**Error:**
Portal returns 502 Bad Gateway

**Solution:**
1. Check PM2 status: `pm2 status sfggc-portal`
2. Check nginx configuration (must proxy /portal to port 3000)
3. See `deploy_docs/PORTAL_DEPLOYMENT.md#7-nginx-configuration`

### First-Time Setup Prompts Don't Appear

**Issue:**
Script doesn't prompt for database credentials

**Cause:**
`.env.local` already exists on server

**Solution:**
```bash
# Remove existing .env.local to force setup
ssh goldengateclassic@54.70.1.215
rm ~/htdocs/www.goldengateclassic.org/portal-app/.env.local

# Run deployment again
./deploy_scripts/deploy.sh --portal
```

### Database/SMTP Passwords Prompted Again on Subsequent Deployments

**Issue:**
After first deployment, running the script again prompts for database and SMTP passwords even though `.env.local` already exists on the server

**Cause:**
Tilde (`~`) in `DEPLOY_PORTAL_PATH` was not being expanded correctly in SSH file existence checks, causing the script to think `.env.local` doesn't exist

**Symptom:**
You see these prompts even though you previously entered the credentials:
```
Database Configuration:
  Database password: ********
  SMTP password (AWS SES): ********
```

**Solution:**
This was fixed in the deployment scripts (v1.1, Feb 2026). Update to the latest version:

```bash
# Pull latest changes
git pull origin main

# Verify the fix in deploy_scripts/lib/ssh.sh
grep -A 2 "Expand tilde" deploy_scripts/lib/ssh.sh
```

**Manual Workaround** (if you can't update):
Use absolute paths instead of tilde in `.deployrc`:
```bash
# Instead of:
DEPLOY_PORTAL_PATH="~/htdocs/www.goldengateclassic.org/portal-app"

# Use absolute path:
DEPLOY_PORTAL_PATH="/home/goldengateclassic/htdocs/www.goldengateclassic.org/portal-app"
```

### Password Prompted Multiple Times During Deployment

**Issue:**
SSH password requested 3+ times during pre-flight checks even though you have SSH access

**Cause:**
SSH key authentication isn't configured, or deployment script isn't using your SSH alias

**Solution:**

1. **Complete SSH key setup:**
   ```bash
   ./deploy_scripts/setup-ssh.sh goldengateclassic@54.70.1.215 sfggc
   ```

2. **Verify passwordless SSH works with alias:**
   ```bash
   ssh sfggc "echo Connection successful"
   ```

3. **Create `.deployrc` to use SSH alias:**
   ```bash
   # Copy and edit to use your SSH alias
   cp .deployrc.example .deployrc
   # Change DEPLOY_SSH_HOST to your alias (e.g., "sfggc")
   ```

   In `.deployrc`:
   ```bash
   DEPLOY_SSH_HOST="sfggc"  # Use SSH alias instead of IP
   ```

### Node.js Not Found on Server (NVM Users)

**Issue:**
```
⚠ Node.js not found on server (required for portal)
```

Even though `node --version` works when you SSH interactively

**Cause:**
NVM isn't loaded in non-interactive SSH sessions (used by deployment script)

**Solution:**

Add NVM initialization to the beginning of your `.bashrc` on the server:

```bash
# SSH to server
ssh your-server

# Add NVM init to top of .bashrc (before non-interactive check)
cat > /tmp/fix_nvm.sh << 'EOF'
#!/bin/bash
if ! grep -q 'NVM initialization for non-interactive' ~/.bashrc; then
  cat > /tmp/bashrc_new << 'INNEREOF'
# NVM initialization for non-interactive shells (deployment, etc.)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

INNEREOF
  cat ~/.bashrc >> /tmp/bashrc_new
  mv /tmp/bashrc_new ~/.bashrc
  echo "✓ NVM initialization added"
else
  echo "✓ Already configured"
fi
EOF
bash /tmp/fix_nvm.sh
```

**Verify the fix:**
```bash
# Test from your local machine
ssh your-server "node --version"
# Should show Node.js version without errors
```

**Why this happens:**
- NVM is typically loaded by `.bashrc` or `.bash_profile`
- These files have a guard that returns early for non-interactive shells
- Deployment scripts use non-interactive SSH, so NVM never loads
- Solution: Add NVM initialization before the non-interactive guard

---

## Advanced Usage

### Override Configuration via CLI

```bash
# Override SSH host
./deploy_scripts/deploy.sh --server 192.168.1.100

# Override SSH user
./deploy_scripts/deploy.sh --user myuser

# Combine overrides
./deploy_scripts/deploy.sh --portal --server prod.example.com --user deploy
```

### Use Alternate Configuration File

```bash
# Create staging configuration
cp .deployrc.example .deployrc.staging
# Edit .deployrc.staging with staging values

# Deploy to staging
./deploy_scripts/deploy.sh --config .deployrc.staging --portal
```

### Skip Confirmation Prompts

```bash
# Useful for CI/CD pipelines
./deploy_scripts/deploy.sh --all --force
```

### Verify Deployment Plan

```bash
# Always test with dry-run first
./deploy_scripts/deploy.sh --portal --dry-run --verbose

# Review output carefully
# Then run actual deployment
./deploy_scripts/deploy.sh --portal
```

---

## Migration from Old Scripts

If you were using the old deployment scripts:

### Old Script Mapping

| Old Script | New Command |
|------------|-------------|
| `deploy.sh <user@host> <path> <domain>` | `./deploy_scripts/deploy.sh --static` |
| `deploy-manual.sh <user@host> <path> <domain>` | `./deploy_scripts/deploy.sh --static --verbose` |
| `deploy-portal.sh <user@host>` | `./deploy_scripts/deploy.sh --portal` |

### Old Scripts Still Work

The old scripts have been converted to wrappers that forward to the new system with deprecation warnings:

```bash
# Still works, but shows warning
./deploy_scripts/deploy-portal.sh goldengateclassic@54.70.1.215

# Output:
# ⚠️ WARNING: This script is deprecated
#    Use: ./deploy_scripts/deploy.sh --portal
# Forwarding to new deployment system...
```

---

## Additional Resources

- **Portal Deployment Details:** `deploy_docs/PORTAL_DEPLOYMENT.md`
- **Server Setup:** `deploy_docs/SERVER_SETUP.md`
- **Nginx Configuration:** `deploy_docs/NGINX_SETUP.md`
- **CloudPanel Guide:** `deploy_docs/CLOUDPANEL_NGINX_GUIDE.md`

---

## Support

For issues or questions:
1. Check this guide and other documentation in `deploy_docs/`
2. Run with `--dry-run --verbose` to diagnose issues
3. Check server logs: `pm2 logs sfggc-portal` (for portal)
4. Report issues at https://github.com/anthropics/claude-code/issues
