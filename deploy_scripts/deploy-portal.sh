#!/usr/bin/env bash
set -euo pipefail

# SFGGC Portal Deployment Script
# Deploys the Next.js portal (server-rendered) to a CloudPanel server with PM2.
#
# Usage:
#   ./deploy_scripts/deploy-portal.sh <ssh_connection>
#
# Example:
#   ./deploy_scripts/deploy-portal.sh goldengateclassic@54.70.1.215

# ─── Constants ───────────────────────────────────────────────────────────────

PORTAL_APP_NAME="sfggc-portal"
REMOTE_APP_DIR="htdocs/www.goldengateclassic.org/portal-app"

# Pre-filled defaults (non-secret)
DEFAULT_DB_HOST="shared2.cdms8mviovca.us-west-2.rds.amazonaws.com"
DEFAULT_DB_PORT="3306"
DEFAULT_DB_NAME="goldengate"
DEFAULT_PORTAL_BASE_URL="https://www.goldengateclassic.org"
DEFAULT_SMTP_HOST="email-smtp.us-west-2.amazonaws.com"
DEFAULT_SMTP_PORT="587"
DEFAULT_SMTP_USER="AKIAVU7WKXGTZZA3SOHN"
DEFAULT_SMTP_FROM="Golden Gate Classic <noreply@goldengateclassic.org>"

# ─── Helpers ─────────────────────────────────────────────────────────────────

info()  { echo "  $1"; }
step()  { echo ""; echo "==> $1"; }
warn()  { echo "  [!] $1"; }
fail()  { echo "  [ERROR] $1"; exit 1; }

prompt_value() {
  local prompt_text="$1"
  local default_val="${2:-}"
  local result
  if [[ -n "$default_val" ]]; then
    read -rp "  $prompt_text [$default_val]: " result
    echo "${result:-$default_val}"
  else
    read -rp "  $prompt_text: " result
    echo "$result"
  fi
}

prompt_secret() {
  local prompt_text="$1"
  local result
  read -rsp "  $prompt_text: " result
  echo ""
  echo "$result"
}

remote() {
  ssh "$SSH_CONNECTION" "$@"
}

# ─── Validate arguments ─────────────────────────────────────────────────────

if [[ -z "${1:-}" ]]; then
  echo "SFGGC Portal Deployment"
  echo ""
  echo "Usage: ./deploy_scripts/deploy-portal.sh <ssh_user@server>"
  echo ""
  echo "Example:"
  echo "  ./deploy_scripts/deploy-portal.sh goldengateclassic@54.70.1.215"
  exit 1
fi

SSH_CONNECTION="$1"

echo ""
echo "SFGGC Portal Deployment"
echo "======================="
echo "  Server: $SSH_CONNECTION"
echo "  Remote: ~/$REMOTE_APP_DIR"
echo ""

# ─── Step 1: Test SSH ────────────────────────────────────────────────────────

step "Testing SSH connection..."
if ! remote "echo ok" > /dev/null 2>&1; then
  fail "Cannot connect to $SSH_CONNECTION. Check your SSH key and server address."
fi
info "SSH connection OK."

# ─── Step 2: Sync project files ─────────────────────────────────────────────

step "Syncing project files to server..."
remote "mkdir -p ~/$REMOTE_APP_DIR"

rsync -az --delete \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='.next/' \
  --exclude='out/' \
  --exclude='.env*' \
  --exclude='deploy_temp_*' \
  ./ "$SSH_CONNECTION:~/$REMOTE_APP_DIR/"

info "Files synced."

# ─── Step 3: Install dependencies ───────────────────────────────────────────

step "Installing dependencies on server..."
remote "cd ~/$REMOTE_APP_DIR && npm install --production 2>&1 | tail -1"
info "Dependencies installed."

# ─── Step 4: Create .env.local (first-time only) ────────────────────────────

ENV_EXISTS=$(remote "test -f ~/$REMOTE_APP_DIR/.env.local && echo yes || echo no")

if [[ "$ENV_EXISTS" == "no" ]]; then
  step "First-time setup: creating .env.local"
  info "I will ask for the values needed. Press Enter to accept defaults."
  echo ""

  DB_USER=$(prompt_value "Database username" "")
  DB_PASS=$(prompt_secret "Database password")
  PORTAL_DB_URL="mysql://${DB_USER}:${DB_PASS}@${DEFAULT_DB_HOST}:${DEFAULT_DB_PORT}/${DEFAULT_DB_NAME}"

  SESSION_SECRET=$(prompt_value "Admin session secret (long random string)" "$(openssl rand -hex 32)")
  SMTP_PASS=$(prompt_secret "SMTP password (AWS SES)")
  PORTAL_BASE_URL=$(prompt_value "Portal base URL" "$DEFAULT_PORTAL_BASE_URL")

  remote "cat > ~/$REMOTE_APP_DIR/.env.local << 'ENVEOF'
# Portal database
PORTAL_DATABASE_URL=${PORTAL_DB_URL}

# Session signing
ADMIN_SESSION_SECRET=${SESSION_SECRET}

# Public URL (used in email links)
PORTAL_BASE_URL=${PORTAL_BASE_URL}

# AWS SES SMTP
SMTP_HOST=${DEFAULT_SMTP_HOST}
SMTP_PORT=${DEFAULT_SMTP_PORT}
SMTP_USER=${DEFAULT_SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${DEFAULT_SMTP_FROM}
ENVEOF"

  info ".env.local created on server."
else
  step "Found existing .env.local — skipping environment setup."
fi

# ─── Step 5: Initialize database schema ─────────────────────────────────────

step "Initializing database schema (idempotent)..."
remote "cd ~/$REMOTE_APP_DIR && bash scripts/dev/init-portal-db.sh 2>&1" || {
  warn "Database init returned an error. This may be OK if the schema already exists."
  warn "Check the output above. Continuing..."
}

# ─── Step 6: Create super admin (first-time only) ───────────────────────────

ADMIN_COUNT=$(remote "cd ~/$REMOTE_APP_DIR && node -e \"
  const url = process.env.PORTAL_DATABASE_URL || '';
  if (!url) { console.log('0'); process.exit(0); }
  const mysql = require('mysql2/promise');
  (async () => {
    try {
      const pool = mysql.createPool(url);
      const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM admins');
      console.log(rows[0].cnt);
      await pool.end();
    } catch(e) { console.log('0'); }
  })();
\" 2>/dev/null" || echo "0")

if [[ "$ADMIN_COUNT" == "0" ]]; then
  step "No admin accounts found. Let's create a super admin."
  ADMIN_EMAIL=$(prompt_value "Admin email" "")
  ADMIN_NAME=$(prompt_value "Admin full name" "")
  ADMIN_PASSWORD=$(prompt_secret "Admin password")

  remote "cd ~/$REMOTE_APP_DIR && \
    ADMIN_EMAIL='${ADMIN_EMAIL}' \
    ADMIN_NAME='${ADMIN_NAME}' \
    ADMIN_PASSWORD='${ADMIN_PASSWORD}' \
    bash backend/scripts/admin/create-super-admin.sh 2>&1"

  info "Super admin created."
else
  info "Admin accounts exist ($ADMIN_COUNT found) — skipping super admin creation."
fi

# ─── Step 7: Build the application ──────────────────────────────────────────

step "Building Next.js application on server..."
remote "cd ~/$REMOTE_APP_DIR && npm run build 2>&1 | tail -5"
info "Build complete."

# ─── Step 8: Start/restart with PM2 ─────────────────────────────────────────

step "Setting up PM2..."

# Install PM2 if missing
PM2_INSTALLED=$(remote "command -v pm2 > /dev/null 2>&1 && echo yes || echo no")
if [[ "$PM2_INSTALLED" == "no" ]]; then
  info "Installing PM2..."
  remote "npm install -g pm2 2>&1 | tail -1"
fi

# Check if process already exists
PM2_STATUS=$(remote "pm2 describe $PORTAL_APP_NAME > /dev/null 2>&1 && echo running || echo stopped")

if [[ "$PM2_STATUS" == "running" ]]; then
  info "Restarting existing PM2 process..."
  remote "cd ~/$REMOTE_APP_DIR && pm2 restart $PORTAL_APP_NAME 2>&1 | tail -3"
else
  info "Starting new PM2 process..."
  remote "cd ~/$REMOTE_APP_DIR && pm2 start npm --name $PORTAL_APP_NAME -- start 2>&1 | tail -3"
fi

# Save PM2 state for auto-restart on reboot
remote "pm2 save 2>&1 | tail -1"

# Set up crontab for PM2 resurrect (idempotent)
CRON_EXISTS=$(remote "crontab -l 2>/dev/null | grep -c 'pm2 resurrect' || true")
if [[ "$CRON_EXISTS" == "0" ]]; then
  info "Adding PM2 resurrect to crontab..."
  remote "
    PM2_PATH=\$(which pm2)
    (crontab -l 2>/dev/null; echo \"@reboot \$PM2_PATH resurrect &> /dev/null\") | crontab -
  "
  info "Crontab updated."
else
  info "PM2 resurrect already in crontab."
fi

# ─── Done ────────────────────────────────────────────────────────────────────

echo ""
echo "====================================="
echo "  Portal deployment complete!"
echo "====================================="
echo ""
echo "  PM2 status:"
remote "pm2 status $PORTAL_APP_NAME 2>&1 | head -10" || true
echo ""
echo "  Next steps:"
echo "  1. Update nginx to proxy /portal and /api/portal to port 3000"
echo "     (see deploy_docs/PORTAL_DEPLOYMENT.md for the nginx config)"
echo "  2. Test: https://www.goldengateclassic.org/portal/"
echo "  3. Test admin login at /portal/admin/"
echo "  4. Test participant login at /portal/participant/"
echo ""
echo "  Useful commands (on server):"
echo "    pm2 logs $PORTAL_APP_NAME      # View application logs"
echo "    pm2 restart $PORTAL_APP_NAME   # Restart the portal"
echo "    pm2 status                      # Check all PM2 processes"
echo ""
