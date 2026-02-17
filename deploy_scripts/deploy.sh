#!/bin/bash
# SFGGC Unified Deployment Script
#
# Deploys static site, portal application, or both to production server.
#
# Usage:
#   ./deploy_scripts/deploy.sh [OPTIONS]
#
# Options:
#   --static          Deploy static site only (default if no flags)
#   --portal          Deploy portal application only
#   --all             Deploy both static and portal
#   --dry-run         Show what would happen without executing
#   --verbose         Show detailed dry-run output (with --dry-run)
#   --debug           Show full debug output (with --dry-run)
#   --config FILE     Use alternate config file (default: .deployrc)
#   --server HOST     Override SSH host
#   --user USER       Override SSH user
#   --path PATH       Override deployment path
#   -y, --yes         Skip confirmation prompts (auto-confirm deployment)
#   --setup           Force environment reconfiguration (recreates .env.local)
#   --skip-migrations Skip database migrations (not recommended)
#   -h, --help        Show this help
#
# Examples:
#   # Deploy static site (default)
#   ./deploy_scripts/deploy.sh
#
#   # Deploy portal only
#   ./deploy_scripts/deploy.sh --portal
#
#   # Deploy everything
#   ./deploy_scripts/deploy.sh --all
#
#   # Dry run for portal
#   ./deploy_scripts/deploy.sh --portal --dry-run
#
#   # Dry run with details
#   ./deploy_scripts/deploy.sh --all --dry-run --verbose
#
#   # Force environment reconfiguration (recover from broken .env.local)
#   ./deploy_scripts/deploy.sh --portal --setup

set -euo pipefail

# ─── Get script directory ────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Source function libraries ───────────────────────────────────────────────

source "$SCRIPT_DIR/lib/output.sh"
source "$SCRIPT_DIR/lib/config.sh"
source "$SCRIPT_DIR/lib/ssh.sh"
source "$SCRIPT_DIR/lib/validation.sh"
source "$SCRIPT_DIR/lib/build.sh"
source "$SCRIPT_DIR/lib/optimize-images.sh"
source "$SCRIPT_DIR/lib/deploy-static.sh"
source "$SCRIPT_DIR/lib/deploy-portal.sh"

# ─── Default values ──────────────────────────────────────────────────────────

DEPLOY_STATIC=false
DEPLOY_PORTAL=false
DEPLOY_ALL=false
DRY_RUN=false
VERBOSE=false
DEBUG=false
FORCE=false
FORCE_SETUP=false
SKIP_MIGRATIONS=false
CONFIG_FILE=".deployrc"

CLI_SSH_HOST=""
CLI_SSH_USER=""
CLI_STATIC_PATH=""
CLI_PORTAL_PATH=""

# ─── Help function ───────────────────────────────────────────────────────────

show_help() {
  cat << 'EOF'
SFGGC Unified Deployment Script

Usage:
  ./deploy_scripts/deploy.sh [OPTIONS]

Options:
  --static          Deploy static site only (default if no flags)
  --portal          Deploy portal application only
  --all             Deploy both static and portal
  --dry-run         Show what would happen without executing
  --verbose         Show detailed dry-run output (with --dry-run)
  --debug           Show full debug output (with --dry-run)
  --config FILE     Use alternate config file (default: .deployrc)
  --server HOST     Override SSH host
  --user USER       Override SSH user
  -y, --yes         Skip confirmation prompts (auto-confirm deployment)
  --setup           Force environment reconfiguration (recreates .env.local)
  -h, --help        Show this help

Examples:
  # Deploy static site (default)
  ./deploy_scripts/deploy.sh

  # Deploy portal only
  ./deploy_scripts/deploy.sh --portal

  # Deploy everything
  ./deploy_scripts/deploy.sh --all

  # Dry run for portal
  ./deploy_scripts/deploy.sh --portal --dry-run

  # Dry run with details
  ./deploy_scripts/deploy.sh --all --dry-run --verbose

  # Force environment reconfiguration (recover from broken .env.local)
  ./deploy_scripts/deploy.sh --portal --setup

  # Deploy everything with auto-confirmation
  ./deploy_scripts/deploy.sh --all --yes

Configuration:
  Create .deployrc from .deployrc.example for default settings:
    cp .deployrc.example .deployrc
    # Edit .deployrc with your values
    chmod 600 .deployrc

For more information, see:
  deploy_docs/UNIFIED_DEPLOYMENT.md
EOF
}

# ─── Parse arguments ─────────────────────────────────────────────────────────

parse_arguments() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --static)
        DEPLOY_STATIC=true
        shift
        ;;
      --portal)
        DEPLOY_PORTAL=true
        shift
        ;;
      --all)
        DEPLOY_ALL=true
        shift
        ;;
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --verbose)
        VERBOSE=true
        shift
        ;;
      --debug)
        DEBUG=true
        VERBOSE=true  # Debug implies verbose
        shift
        ;;
      --config)
        CONFIG_FILE="$2"
        shift 2
        ;;
      --server)
        CLI_SSH_HOST="$2"
        shift 2
        ;;
      --user)
        CLI_SSH_USER="$2"
        shift 2
        ;;
      -y|--yes|--force)
        FORCE=true
        shift
        ;;
      --setup)
        FORCE_SETUP=true
        shift
        ;;
      --skip-migrations)
        SKIP_MIGRATIONS=true
        shift
        ;;
      -h|--help)
        show_help
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        echo ""
        show_help
        exit 1
        ;;
    esac
  done

  # Export for use in sourced scripts
  export DRY_RUN VERBOSE DEBUG FORCE FORCE_SETUP SKIP_MIGRATIONS
}

# ─── Determine deployment mode ───────────────────────────────────────────────

determine_mode() {
  if [ "$DEPLOY_ALL" = true ]; then
    echo "all"
  elif [ "$DEPLOY_PORTAL" = true ]; then
    echo "portal"
  else
    echo "static"  # Default
  fi
}

# ─── Main execution ──────────────────────────────────────────────────────────

main() {
  local start_time=$(date +%s)

  # Parse command line arguments
  parse_arguments "$@"

  # Determine deployment mode
  local mode=$(determine_mode)
  export DEPLOY_MODE="$mode"

  # Load configuration
  load_config "$CONFIG_FILE"

  # Set defaults for missing values
  set_defaults

  # Apply CLI overrides
  override_from_cli

  # Validate configuration
  validate_config

  # Show deployment plan
  show_deployment_plan "$mode"

  # Show debug config if enabled
  if [ "$DEBUG" = true ]; then
    show_config
  fi

  # Confirm if not forced and not dry-run
  if [ "$FORCE" != true ] && [ "$DRY_RUN" != true ]; then
    confirm_deployment || exit 0
  fi

  # Run pre-flight checks
  if [ "$DRY_RUN" != true ]; then
    run_all_checks "$mode" || exit 1
  fi

  # Execute deployment based on mode
  case "$mode" in
    static)
      deploy_static || exit 1
      ;;
    portal)
      deploy_portal || exit 1
      ;;
    all)
      deploy_static || exit 1

      # CRITICAL: Ensure config is restored to server mode before portal deployment
      # Static build temporarily changes next.config.js to export mode, then restores it.
      # We must verify restoration completed before syncing files for portal.
      log_step "Verifying server-mode config before portal deployment"
      if ! check_config_is_server_mode "next.config.js"; then
        log_error "Config still has 'output: export' after static build"
        log_error "This would break portal deployment. Restoring now..."
        restore_next_config

        # Verify restoration worked
        if ! check_config_is_server_mode "next.config.js"; then
          log_error "Failed to restore server-mode config"
          exit 1
        fi
      fi
      log_success "Config verified: server mode active"

      echo ""
      deploy_portal || exit 1
      ;;
  esac

  # Show final summary
  echo ""
  log_section "DEPLOYMENT COMPLETE"
  log_elapsed_time "$start_time"

  if [ -n "${DEPLOY_DOMAIN:-}" ]; then
    echo ""
    log_info "Your deployment is available at:"
    if [ "$mode" = "static" ] || [ "$mode" = "all" ]; then
      log_info "  Static site: https://${DEPLOY_DOMAIN}"
    fi
    if [ "$mode" = "portal" ] || [ "$mode" = "all" ]; then
      log_info "  Portal:      https://${DEPLOY_DOMAIN}/portal/"
    fi
  fi

  echo ""
}

# Run main with all arguments
main "$@"
