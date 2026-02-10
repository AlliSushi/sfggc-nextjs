#!/bin/bash
# build.sh - Build orchestration for static and portal modes

# backup_next_config - Save original next.config.js
backup_next_config() {
  if [ -f "next.config.js" ]; then
    cp next.config.js next.config.js.backup
    if [ "${DEBUG:-false}" = true ]; then
      log_info "Backed up next.config.js"
    fi
  fi
}

# restore_next_config - Restore original next.config.js
restore_next_config() {
  if [ -f "next.config.js.backup" ]; then
    log_info "Restoring config: export mode -> server mode"
    mv next.config.js.backup next.config.js

    # Verify restoration
    if check_config_is_server_mode "next.config.js"; then
      log_success "Config restored: server mode active"
    else
      log_warn "Config restored but may not be in server mode"
    fi
  fi
}

# configure_static_build - Set next.config.js for static export
configure_static_build() {
  log_step "Configuring for static build"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would set output: 'export' in next.config.js"
    return 0
  fi

  log_info "Switching config: server mode -> export mode"

  # Create static-mode config (excludes /portal routes)
  cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true
  },
  // Exclude portal routes from static export
  exportPathMap: async function (defaultPathMap) {
    const pathMap = {};
    for (const [path, route] of Object.entries(defaultPathMap)) {
      // Only export non-portal pages
      if (!path.startsWith('/portal') && !path.startsWith('/api/portal')) {
        pathMap[path] = route;
      }
    }
    return pathMap;
  }
}

module.exports = nextConfig
EOF

  log_success "Config set: export mode enabled"
}

# build_static - Build static site
build_static() {
  log_section "BUILDING STATIC SITE"

  # Backup config
  backup_next_config

  # Ensure restore runs on exit
  trap restore_next_config EXIT

  # Configure for static build
  configure_static_build

  # Remove previous build
  if [ -d "out" ] && [ "${DRY_RUN:-false}" != true ]; then
    log_step "Removing previous build"
    rm -rf out
  fi

  # Run build
  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would run: npm run build"
  else
    log_step "Running npm run build"
    if npm run build; then
      log_success "Build completed successfully"
    else
      log_error "Build failed"
      restore_next_config
      exit 1
    fi
  fi

  # Validate output
  validate_out_directory

  # Restore config
  restore_next_config

  # Remove trap since we restored manually
  trap - EXIT
}

# validate_out_directory - Check static build output
validate_out_directory() {
  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would validate out/ directory"
    return 0
  fi

  if [ ! -d "out" ]; then
    log_error "Build output directory 'out/' not found"
    return 1
  fi

  local file_count=$(find out -type f | wc -l | tr -d ' ')
  local html_count=$(find out -name "*.html" | wc -l | tr -d ' ')

  if [ "$file_count" -eq 0 ]; then
    log_error "Build output directory is empty"
    return 1
  fi

  if [ "$html_count" -eq 0 ]; then
    log_error "No HTML files found in build output"
    return 1
  fi

  log_success "Build output validated: $file_count files ($html_count HTML)"
  return 0
}

# build_portal_local - Build portal locally (for testing)
build_portal_local() {
  log_section "BUILDING PORTAL APPLICATION"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would run: npm run build"
    return 0
  fi

  # Ensure no output: 'export' in config
  if grep -q "output.*export" next.config.js 2>/dev/null; then
    log_warn "Found 'output: export' in next.config.js"
    log_info "Portal requires server mode (no output: 'export')"
    log_info "Temporarily removing for portal build..."

    backup_next_config

    # Create server-mode config (compress: false lets nginx handle compression)
    cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: false,
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
EOF

    trap restore_next_config EXIT
  fi

  log_step "Running npm run build"
  if npm run build; then
    log_success "Build completed successfully"
  else
    log_error "Build failed"
    restore_next_config
    exit 1
  fi

  validate_next_build

  # Restore if we modified
  if [ -f "next.config.js.backup" ]; then
    restore_next_config
    trap - EXIT
  fi
}

# validate_next_build - Check portal build output
validate_next_build() {
  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would validate .next/ directory"
    return 0
  fi

  if [ ! -d ".next" ]; then
    log_error "Build output directory '.next/' not found"
    return 1
  fi

  log_success "Build output validated"
  return 0
}

# check_config_has_export_mode - Verify config contains output: 'export'
check_config_has_export_mode() {
  local config_file="${1:-next.config.js}"

  if [ ! -f "$config_file" ]; then
    return 1
  fi

  grep -q "output.*['\"]export['\"]" "$config_file"
  return $?
}

# check_config_is_server_mode - Verify config does NOT have output: 'export'
check_config_is_server_mode() {
  local config_file="${1:-next.config.js}"

  if [ ! -f "$config_file" ]; then
    return 1
  fi

  if grep -q "output.*['\"]export['\"]" "$config_file"; then
    return 1  # Found export mode, NOT server mode
  fi

  return 0  # Server mode (no export)
}

# ensure_server_mode_config - Ensure next.config.js is in server mode
ensure_server_mode_config() {
  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would verify server-mode config"
    return 0
  fi

  if ! check_config_is_server_mode "next.config.js"; then
    log_warn "Config has 'output: export' but portal requires server mode"
    log_info "Creating server-mode config..."

    backup_next_config

    cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: false,
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
EOF

    log_success "Server-mode config created"
    return 0
  fi

  log_info "Config is already in server mode"
  return 0
}

# install_dependencies - Run npm install
install_dependencies() {
  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would run: npm install"
    return 0
  fi

  if [ ! -d "node_modules" ]; then
    log_step "Installing dependencies"
    npm install
  else
    log_info "Dependencies already installed"
  fi
}
