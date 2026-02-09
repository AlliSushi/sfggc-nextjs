#!/bin/bash
# deploy-portal.sh - Portal application deployment logic

# Source migrations library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/deploy-migrations.sh"

# sync_portal_files - Upload portal application files to server
sync_portal_files() {
  log_step "Syncing portal application files"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would sync project files to ${DEPLOY_PORTAL_PATH}"
    if [ "${VERBOSE:-false}" = true ]; then
      log_info "  Excludes: node_modules, .git, .next, out, .env*"
    fi
    return 0
  fi

  # Show current local config status
  if check_config_is_server_mode "next.config.js"; then
    log_info "Local config: server mode (correct for portal)"
  else
    log_warn "Local config: export mode (will be fixed on server)"
  fi

  # Create remote directory
  ssh_command "mkdir -p ${DEPLOY_PORTAL_PATH}"

  # Sync files with exclusions
  local rsync_cmd="rsync -az --delete \
    --exclude='node_modules/' \
    --exclude='.git/' \
    --exclude='.next/' \
    --exclude='out/' \
    --exclude='.env*' \
    --exclude='deploy_temp_*' \
    ./ ${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}:${DEPLOY_PORTAL_PATH}/"

  if eval "$rsync_cmd"; then
    log_success "Files synced successfully"
  else
    log_error "File sync failed"
    return 1
  fi

  return 0
}

# setup_portal_environment - Create .env.local on server (first-time only, or with --setup flag)
setup_portal_environment() {
  log_step "Checking portal environment configuration"

  # Check if .env.local already exists (skip check if --setup flag is set)
  if check_remote_file_exists "${DEPLOY_PORTAL_PATH}/.env.local"; then
    if [ "${FORCE_SETUP:-false}" = true ]; then
      log_warn "Existing .env.local found, but --setup flag forces reconfiguration"
    else
      log_info "Environment already configured"
      return 0
    fi
  fi

  if [ "${FORCE_SETUP:-false}" = true ]; then
    log_warn "Environment reconfiguration requested (--setup flag)"
  else
    log_warn "First-time portal deployment detected"
  fi
  log_info "Interactive setup required for secrets"
  echo ""

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would prompt for database password"
    log_dry_run "Would prompt for SMTP password"
    log_dry_run "Would generate session secret"
    log_dry_run "Would create .env.local on server"
    return 0
  fi

  # Database configuration
  echo "Database Configuration:"

  # Use username from config (non-secret, always "goldengate")
  local DB_USER="${DEPLOY_DB_USER}"
  log_info "Database username: $DB_USER (from config)"

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

  local PORTAL_DB_URL="mysql://${DB_USER}:${DB_PASS}@${DEPLOY_DB_HOST}:${DEPLOY_DB_PORT}/${DEPLOY_DB_NAME}"

  # Generate or use provided session secret
  local SESSION_SECRET="${DEPLOY_SESSION_SECRET:-$(openssl rand -hex 32)}"
  if [ -z "${DEPLOY_SESSION_SECRET:-}" ]; then
    read -p "  Admin session secret [$SESSION_SECRET]: " SESSION_INPUT
    SESSION_SECRET="${SESSION_INPUT:-$SESSION_SECRET}"
  else
    log_info "Session secret: (from DEPLOY_SESSION_SECRET env var)"
  fi

  # Get SMTP password (from env var or prompt)
  local SMTP_PASS="${DEPLOY_SMTP_PASSWORD:-}"
  if [ -z "$SMTP_PASS" ]; then
    # Check if running interactively
    if [ ! -t 0 ]; then
      log_error "SMTP password required but not provided"
      log_error "Set environment variable: export DEPLOY_SMTP_PASSWORD='your_password'"
      return 1
    fi
    read -sp "  SMTP password (AWS SES): " SMTP_PASS
    echo ""
  else
    log_info "SMTP password: (from DEPLOY_SMTP_PASSWORD env var)"
  fi

  # Get portal base URL (from env var or prompt)
  local PORTAL_BASE_URL="${DEPLOY_PORTAL_BASE_URL:-https://${DEPLOY_DOMAIN}}"
  if [ -z "${DEPLOY_PORTAL_BASE_URL:-}" ]; then
    read -p "  Portal base URL [$PORTAL_BASE_URL]: " PORTAL_BASE_URL_INPUT
    PORTAL_BASE_URL="${PORTAL_BASE_URL_INPUT:-$PORTAL_BASE_URL}"
  else
    log_info "Portal base URL: $PORTAL_BASE_URL (from DEPLOY_PORTAL_BASE_URL env var)"
  fi

  # Create .env.local on server
  log_step "Creating .env.local on server"

  ssh_command "cat > ${DEPLOY_PORTAL_PATH}/.env.local << 'ENVEOF'
# Portal database
PORTAL_DATABASE_URL=${PORTAL_DB_URL}

# Session signing
ADMIN_SESSION_SECRET=${SESSION_SECRET}

# Public URL (used in email links)
PORTAL_BASE_URL=${PORTAL_BASE_URL}

# AWS SES SMTP
SMTP_HOST=${DEPLOY_SMTP_HOST}
SMTP_PORT=${DEPLOY_SMTP_PORT}
SMTP_USER=${DEPLOY_SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=\"${DEPLOY_SMTP_FROM}\"
ENVEOF"

  if [ $? -eq 0 ]; then
    log_success "Environment configured successfully"
  else
    log_error "Failed to create .env.local"
    return 1
  fi

  return 0
}

# initialize_database - Run database schema initialization
initialize_database() {
  log_step "Initializing database schema"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would run: bash scripts/dev/init-portal-db.sh"
    return 0
  fi

  # Run init script (idempotent)
  if ssh_command "cd ${DEPLOY_PORTAL_PATH} && bash scripts/dev/init-portal-db.sh 2>&1"; then
    log_success "Database schema initialized"
  else
    log_warn "Database init returned an error (may be OK if schema exists)"
    log_info "Check output above. Continuing..."
  fi

  return 0
}

# create_super_admin - Create first admin account (first-time only)
create_super_admin() {
  log_step "Checking for admin accounts"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would check admin count"
    log_dry_run "Would create super admin if none exist"
    return 0
  fi

  # Count existing admins
  local ADMIN_COUNT=$(ssh_command "cd ${DEPLOY_PORTAL_PATH} && node -e \"
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

  if [ "$ADMIN_COUNT" = "0" ]; then
    log_warn "No admin accounts found"
    log_info "Creating super admin account"
    echo ""

    # Get admin credentials (from env vars or prompt)
    local ADMIN_EMAIL="${DEPLOY_ADMIN_EMAIL:-}"
    local ADMIN_NAME="${DEPLOY_ADMIN_NAME:-}"
    local ADMIN_PASSWORD="${DEPLOY_ADMIN_PASSWORD:-}"

    if [ -z "$ADMIN_EMAIL" ]; then
      # Check if running interactively
      if [ ! -t 0 ]; then
        log_error "Admin email required but not provided"
        log_error "Set environment variable: export DEPLOY_ADMIN_EMAIL='your@email.com'"
        return 1
      fi
      read -p "  Admin email: " ADMIN_EMAIL
    else
      log_info "Admin email: $ADMIN_EMAIL (from DEPLOY_ADMIN_EMAIL env var)"
    fi

    if [ -z "$ADMIN_NAME" ]; then
      if [ ! -t 0 ]; then
        log_error "Admin name required but not provided"
        log_error "Set environment variable: export DEPLOY_ADMIN_NAME='Your Name'"
        return 1
      fi
      read -p "  Admin full name: " ADMIN_NAME
    else
      log_info "Admin name: $ADMIN_NAME (from DEPLOY_ADMIN_NAME env var)"
    fi

    if [ -z "$ADMIN_PASSWORD" ]; then
      if [ ! -t 0 ]; then
        log_error "Admin password required but not provided"
        log_error "Set environment variable: export DEPLOY_ADMIN_PASSWORD='your_password'"
        return 1
      fi
      read -sp "  Admin password: " ADMIN_PASSWORD
      echo ""
    else
      log_info "Admin password: (from DEPLOY_ADMIN_PASSWORD env var)"
    fi

    # Escape credentials for safe passing through SSH
    # This handles spaces, quotes, and special characters in admin names
    local ESCAPED_EMAIL=$(printf '%q' "${ADMIN_EMAIL}")
    local ESCAPED_NAME=$(printf '%q' "${ADMIN_NAME}")
    local ESCAPED_PASSWORD=$(printf '%q' "${ADMIN_PASSWORD}")

    ssh_command "cd ${DEPLOY_PORTAL_PATH} && \
      ADMIN_EMAIL=${ESCAPED_EMAIL} \
      ADMIN_NAME=${ESCAPED_NAME} \
      ADMIN_PASSWORD=${ESCAPED_PASSWORD} \
      bash backend/scripts/admin/create-super-admin.sh 2>&1"

    if [ $? -eq 0 ]; then
      log_success "Super admin created successfully"
    else
      log_error "Failed to create super admin"
      return 1
    fi
  else
    log_info "Admin accounts exist ($ADMIN_COUNT found)"
  fi

  return 0
}

# install_portal_dependencies - Install npm packages on server
install_portal_dependencies() {
  log_step "Installing dependencies on server"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would run: npm install --production"
    return 0
  fi

  ssh_command "cd ${DEPLOY_PORTAL_PATH} && npm install --production 2>&1 | tail -1"

  if [ $? -eq 0 ]; then
    log_success "Dependencies installed"
  else
    log_error "Dependency installation failed"
    return 1
  fi

  return 0
}

# validate_server_config - Ensure server has correct config before building
validate_server_config() {
  log_step "Validating server configuration"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would check next.config.js on server"
    log_dry_run "Would verify no 'output: export' in config"
    return 0
  fi

  # Check if config has export mode (would break portal)
  local has_export=$(ssh_command "cd ${DEPLOY_PORTAL_PATH} && grep -c \"output.*['\\\"]export['\\\"]\" next.config.js 2>/dev/null || echo 0")

  if [ "$has_export" != "0" ]; then
    log_info "Server config has 'output: export' - portal requires server mode"
    log_info "Fixing server configuration..."

    # Create server-mode config on server
    ssh_command "cd ${DEPLOY_PORTAL_PATH} && cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
EOF"

    if [ $? -eq 0 ]; then
      log_success "Server config fixed: server mode enabled"
    else
      log_error "Failed to fix server config"
      return 1
    fi
  else
    log_success "Server config validated: server mode active"
  fi

  return 0
}

# build_portal_on_server - Build Next.js application on server
build_portal_on_server() {
  log_step "Building Next.js application on server"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would validate server config"
    log_dry_run "Would run: npm run build"
    return 0
  fi

  # CRITICAL: Always validate config before building
  # Files may have been synced with wrong config from local machine
  validate_server_config || return 1

  # Remove old build to force fresh build with correct config
  log_info "Removing old build directory..."
  ssh_command "cd ${DEPLOY_PORTAL_PATH} && rm -rf .next"

  log_info "Running build with validated config..."
  ssh_command "cd ${DEPLOY_PORTAL_PATH} && npm run build 2>&1 | tail -5"

  if [ $? -eq 0 ]; then
    log_success "Build completed successfully"
  else
    log_error "Build failed"
    return 1
  fi

  return 0
}

# manage_pm2 - Install/start/restart PM2 process
manage_pm2() {
  log_step "Managing PM2 process"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would check PM2 installation"
    log_dry_run "Would start/restart ${DEPLOY_PM2_APP_NAME}"
    log_dry_run "Would save PM2 state"
    log_dry_run "Would configure PM2 auto-restart"
    return 0
  fi

  # Install PM2 if missing
  local PM2_INSTALLED=$(ssh_command "command -v pm2 > /dev/null 2>&1 && echo yes || echo no")
  if [ "$PM2_INSTALLED" = "no" ]; then
    log_info "Installing PM2..."
    ssh_command "npm install -g pm2 2>&1 | tail -1"
    log_success "PM2 installed"
  fi

  # Check if process exists
  local PM2_STATUS=$(ssh_command "pm2 describe ${DEPLOY_PM2_APP_NAME} > /dev/null 2>&1 && echo running || echo stopped")

  if [ "$PM2_STATUS" = "running" ]; then
    log_info "Restarting existing PM2 process..."
    ssh_command "cd ${DEPLOY_PORTAL_PATH} && pm2 restart ${DEPLOY_PM2_APP_NAME} 2>&1 | tail -3"
  else
    log_info "Starting new PM2 process..."
    ssh_command "cd ${DEPLOY_PORTAL_PATH} && pm2 start npm --name ${DEPLOY_PM2_APP_NAME} -- start 2>&1 | tail -3"
  fi

  # Save PM2 state
  ssh_command "pm2 save 2>&1 | tail -1"
  log_success "PM2 process configured"

  # Set up crontab for auto-restart
  local CRON_EXISTS=$(ssh_command "crontab -l 2>/dev/null | grep -c 'pm2 resurrect' || true")
  if [ "$CRON_EXISTS" = "0" ]; then
    log_info "Adding PM2 resurrect to crontab..."
    ssh_command "
      PM2_PATH=\$(which pm2)
      (crontab -l 2>/dev/null; echo \"@reboot \$PM2_PATH resurrect &> /dev/null\") | crontab -
    "
    log_success "Auto-restart configured"
  else
    log_info "PM2 auto-restart already configured"
  fi

  return 0
}

# verify_portal_deployment - Check portal is running
verify_portal_deployment() {
  log_step "Verifying portal deployment"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would check PM2 status"
    log_dry_run "Would test portal HTTP response"
    return 0
  fi

  # Check PM2 status
  local PM2_OUTPUT=$(ssh_command "pm2 status ${DEPLOY_PM2_APP_NAME} 2>&1 | head -10")

  if echo "$PM2_OUTPUT" | grep -q "online"; then
    log_success "PM2 process is online"
  else
    log_error "PM2 process is not running"
    echo "$PM2_OUTPUT"
    return 1
  fi

  # Test HTTP response (if domain configured)
  if command -v curl >/dev/null 2>&1 && [ -n "${DEPLOY_DOMAIN:-}" ]; then
    local response=$(curl -s -o /dev/null -w "%{http_code}" "https://${DEPLOY_DOMAIN}/portal/" 2>/dev/null || echo "000")
    if [ "$response" = "200" ]; then
      log_success "Portal is responding: https://${DEPLOY_DOMAIN}/portal/"
    else
      log_warn "Portal may not be responding yet (HTTP $response)"
      log_info "Check nginx configuration and PM2 logs"
    fi
  fi

  return 0
}

# deploy_portal - Main portal deployment orchestrator
deploy_portal() {
  local start_time=$(date +%s)

  log_section "PORTAL APPLICATION DEPLOYMENT"

  # Sync files
  sync_portal_files || {
    log_error "Portal deployment failed at file sync"
    return 1
  }

  # Install dependencies
  install_portal_dependencies || {
    log_error "Portal deployment failed at dependency installation"
    return 1
  }

  # Setup environment (first-time only)
  setup_portal_environment || {
    log_error "Portal deployment failed at environment setup"
    return 1
  }

  # Initialize database
  initialize_database

  # Run database migrations
  if check_migration_safety; then
    run_migrations || {
      log_warn "Some migrations failed, but continuing deployment"
    }
  fi

  # Create super admin (first-time only)
  create_super_admin || {
    log_error "Portal deployment failed at admin creation"
    return 1
  }

  # Build application
  build_portal_on_server || {
    log_error "Portal deployment failed at build"
    return 1
  }

  # Manage PM2
  manage_pm2 || {
    log_error "Portal deployment failed at PM2 setup"
    return 1
  }

  # Verify deployment
  verify_portal_deployment || {
    log_error "Portal verification failed"
    return 1
  }

  # Show completion
  echo ""
  log_success "Portal deployed successfully!"
  log_elapsed_time "$start_time"

  if [ "${DRY_RUN:-false}" != true ]; then
    echo ""
    log_info "Next steps:"
    log_info "  1. Update nginx to proxy /portal and /api/portal to port 3000"
    log_info "     (see deploy_docs/PORTAL_DEPLOYMENT.md for nginx config)"
    log_info "  2. Test: https://${DEPLOY_DOMAIN}/portal/"
    log_info "  3. Test admin login at /portal/admin/"
    echo ""
    log_info "Useful commands (on server):"
    log_info "  pm2 logs ${DEPLOY_PM2_APP_NAME}      # View application logs"
    log_info "  pm2 restart ${DEPLOY_PM2_APP_NAME}   # Restart the portal"
    log_info "  pm2 status                           # Check all PM2 processes"
  fi

  return 0
}
