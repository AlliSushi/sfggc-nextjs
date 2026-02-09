#!/bin/bash
# deploy-static.sh - Static site deployment logic

# generate_htaccess - Create .htaccess for Apache optimization
generate_htaccess() {
  local target_dir="$1"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would create .htaccess file"
    return 0
  fi

  cat > "$target_dir/.htaccess" << 'EOF'
# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
</IfModule>
EOF

  log_success "Created .htaccess for Apache optimization"
}

# create_static_backup - Backup current deployment on server
create_static_backup() {
  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would create backup of existing files"
    return 0
  fi

  # Check if directory exists
  if ssh_command "[ -d \"$DEPLOY_STATIC_PATH\" ]" 2>/dev/null; then
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="${DEPLOY_STATIC_PATH}_backup_${timestamp}"

    log_step "Creating backup: $backup_path"
    ssh_command "cp -r \"$DEPLOY_STATIC_PATH\" \"$backup_path\""

    if [ $? -eq 0 ]; then
      log_success "Backup created successfully"
    else
      log_warn "Backup creation failed (not fatal)"
    fi
  else
    log_info "No existing deployment to backup"
  fi
}

# sync_static_files - Upload static files to server
sync_static_files() {
  log_step "Syncing static files to server"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would sync out/ to ${DEPLOY_STATIC_PATH}"
    if [ "${VERBOSE:-false}" = true ]; then
      log_file_count "out"
    fi
    return 0
  fi

  # Use rsync with --delete to remove old files
  local rsync_cmd="rsync -avz --delete out/ ${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}:${DEPLOY_STATIC_PATH}/"

  if [ "${VERBOSE:-false}" = true ]; then
    log_file_count "out"
  fi

  if eval "$rsync_cmd"; then
    log_success "Files synced successfully"
  else
    log_error "File sync failed"
    return 1
  fi

  return 0
}

# deploy_htaccess - Upload .htaccess to server
deploy_htaccess() {
  log_step "Deploying .htaccess"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would create .htaccess on server"
    return 0
  fi

  # Create .htaccess content and upload via SSH
  ssh_command "cat > \"${DEPLOY_STATIC_PATH}/.htaccess\" << 'HTACCESS_EOF'
# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css \"access plus 1 year\"
    ExpiresByType application/javascript \"access plus 1 year\"
    ExpiresByType image/png \"access plus 1 year\"
    ExpiresByType image/jpg \"access plus 1 year\"
    ExpiresByType image/jpeg \"access plus 1 year\"
    ExpiresByType image/gif \"access plus 1 year\"
    ExpiresByType image/svg+xml \"access plus 1 year\"
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection \"1; mode=block\"
</IfModule>
HTACCESS_EOF"

  if [ $? -eq 0 ]; then
    log_success ".htaccess deployed"
  else
    log_warn ".htaccess deployment failed (not fatal)"
  fi
}

# verify_static_deployment - Check deployed files
verify_static_deployment() {
  log_step "Verifying deployment"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would verify deployment"
    return 0
  fi

  # Check if index.html exists
  if ssh_command "[ -f \"${DEPLOY_STATIC_PATH}/index.html\" ]" 2>/dev/null; then
    log_success "Deployment verified: index.html found"
  else
    log_error "Deployment verification failed: index.html not found"
    return 1
  fi

  # Optional: Test HTTP response
  if command -v curl >/dev/null 2>&1 && [ -n "${DEPLOY_DOMAIN:-}" ]; then
    if curl -s -o /dev/null -w "%{http_code}" "https://${DEPLOY_DOMAIN}" | grep -q "200"; then
      log_success "Site is responding: https://${DEPLOY_DOMAIN}"
    else
      log_warn "Site may not be responding yet (check nginx config)"
    fi
  fi

  return 0
}

# deploy_static - Main static deployment orchestrator
deploy_static() {
  local start_time=$(date +%s)

  log_section "STATIC SITE DEPLOYMENT"

  # Always build fresh to ensure latest changes are deployed
  log_info "Building static site..."
  build_static

  # Create backup on server
  create_static_backup

  # Sync files
  sync_static_files || {
    log_error "Static deployment failed"
    return 1
  }

  # Deploy .htaccess
  deploy_htaccess

  # Verify deployment
  verify_static_deployment || {
    log_error "Verification failed"
    return 1
  }

  # Show completion
  echo ""
  log_success "Static site deployed successfully!"
  log_elapsed_time "$start_time"

  if [ -n "${DEPLOY_DOMAIN:-}" ]; then
    echo ""
    log_info "Your website should be available at:"
    log_info "  https://${DEPLOY_DOMAIN}"
  fi

  return 0
}
