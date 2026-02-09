#!/usr/bin/env bash
# deploy-migrations.sh - Run database migrations during deployment

run_migrations() {
  local migration_dir="backend/scripts/migrations"

  log_step "Running database migrations"

  # Check if migrations directory exists
  if ! ssh_command "[ -d \"${DEPLOY_PORTAL_PATH}/${migration_dir}\" ]"; then
    log_info "No migrations directory found, skipping"
    return 0
  fi

  # Get list of migration scripts
  local migrations
  migrations=$(ssh_command "find \"${DEPLOY_PORTAL_PATH}/${migration_dir}\" -name '*.sh' -type f | sort" 2>/dev/null)

  if [[ -z "$migrations" ]]; then
    log_info "No migration scripts found"
    return 0
  fi

  # Run each migration
  local migration_count=0
  local failed_migrations=()

  while IFS= read -r migration_path; do
    local migration_name
    migration_name=$(basename "$migration_path")

    log_info "Running migration: $migration_name"

    if [[ "$DRY_RUN" == "true" ]]; then
      log_dry_run "Would execute migration: $migration_name"
      ((migration_count++))
      continue
    fi

    # Execute migration
    local output
    if output=$(ssh_command "cd \"${DEPLOY_PORTAL_PATH}\" && bash \"$migration_path\" 2>&1"); then
      # Check output for success indicators
      if echo "$output" | grep -qi "already exists\|migration complete\|successfully"; then
        log_success "✓ $migration_name completed"
        ((migration_count++))
      else
        log_warn "⚠ $migration_name produced unexpected output:"
        echo "$output" | sed 's/^/  /'
        ((migration_count++))
      fi
    else
      log_error "✗ $migration_name failed"
      echo "$output" | sed 's/^/  /'
      failed_migrations+=("$migration_name")
    fi
  done <<< "$migrations"

  # Summary
  if [[ ${#failed_migrations[@]} -gt 0 ]]; then
    log_error "Migration failures: ${failed_migrations[*]}"
    log_error "Some migrations failed. Manual intervention may be required."
    return 1
  elif [[ $migration_count -gt 0 ]]; then
    log_success "All $migration_count migration(s) completed successfully"
  else
    log_info "No migrations executed"
  fi

  return 0
}

# Check if running with required migration flag
check_migration_safety() {
  if [[ "${SKIP_MIGRATIONS:-false}" == "true" ]]; then
    log_warn "Skipping migrations (--skip-migrations flag used)"
    return 1
  fi

  if [[ "${RUN_MIGRATIONS:-true}" == "false" ]]; then
    log_warn "Migrations disabled"
    return 1
  fi

  return 0
}
