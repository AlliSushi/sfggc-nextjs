#!/bin/bash
# output.sh - Colored logging and output functions for deployment scripts

# Color codes
COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
COLOR_CYAN='\033[0;36m'
COLOR_GRAY='\033[0;90m'
COLOR_RESET='\033[0m'

# Emoji/symbols for better visual feedback
SYMBOL_SUCCESS="✓"
SYMBOL_ERROR="✗"
SYMBOL_WARN="⚠"
SYMBOL_INFO="ℹ"
SYMBOL_STEP="→"
SYMBOL_DRY_RUN="○"

# log_info - Blue informational messages
log_info() {
  echo -e "${COLOR_BLUE}${SYMBOL_INFO}${COLOR_RESET} $*"
}

# log_success - Green success messages
log_success() {
  echo -e "${COLOR_GREEN}${SYMBOL_SUCCESS}${COLOR_RESET} $*"
}

# log_warn - Yellow warnings
log_warn() {
  echo -e "${COLOR_YELLOW}${SYMBOL_WARN}${COLOR_RESET} $*"
}

# log_error - Red errors
log_error() {
  echo -e "${COLOR_RED}${SYMBOL_ERROR}${COLOR_RESET} $*" >&2
}

# log_step - Numbered step indicators
log_step() {
  echo -e "${COLOR_CYAN}${SYMBOL_STEP}${COLOR_RESET} $*"
}

# log_dry_run - Special formatting for dry-run mode
log_dry_run() {
  echo -e "${COLOR_GRAY}${SYMBOL_DRY_RUN}${COLOR_RESET} ${COLOR_GRAY}$*${COLOR_RESET}"
}

# log_section - Section headers
log_section() {
  echo ""
  echo -e "${COLOR_CYAN}=== $* ===${COLOR_RESET}"
  echo ""
}

# log_subsection - Subsection headers
log_subsection() {
  echo ""
  echo -e "${COLOR_BLUE}--- $* ---${COLOR_RESET}"
}

# execute_command - Wrapper for commands that respects dry-run mode
# Usage: execute_command "Description" "command to run"
execute_command() {
  local description="$1"
  shift
  local command="$*"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "$description"

    if [ "${VERBOSE:-false}" = true ]; then
      echo -e "  ${COLOR_GRAY}Command: $command${COLOR_RESET}"
    fi

    if [ "${DEBUG:-false}" = true ]; then
      echo -e "  ${COLOR_GRAY}Working dir: $(pwd)${COLOR_RESET}"
      echo -e "  ${COLOR_GRAY}User: $(whoami)${COLOR_RESET}"
    fi

    return 0  # Simulate success in dry-run
  else
    log_step "$description"
    eval "$command"
  fi
}

# show_deployment_plan - Display deployment plan summary
show_deployment_plan() {
  local mode="$1"

  log_section "DEPLOYMENT PLAN"

  case "$mode" in
    static)
      log_info "Mode: Static Site"
      ;;
    portal)
      log_info "Mode: Portal Application"
      ;;
    all)
      log_info "Mode: Static Site + Portal Application"
      ;;
  esac

  log_info "Server: ${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}"

  if [ "$mode" = "static" ] || [ "$mode" = "all" ]; then
    log_info "Static Path: ${DEPLOY_STATIC_PATH}"
  fi

  if [ "$mode" = "portal" ] || [ "$mode" = "all" ]; then
    log_info "Portal Path: ${DEPLOY_PORTAL_PATH}"
  fi

  if [ "${DRY_RUN:-false}" = true ]; then
    echo ""
    log_warn "DRY RUN MODE - No actual changes will be made"
    if [ "${VERBOSE:-false}" = true ]; then
      log_info "Verbose output enabled"
    fi
    if [ "${DEBUG:-false}" = true ]; then
      log_info "Debug output enabled"
    fi
  fi
}

# confirm_deployment - Ask user for confirmation
confirm_deployment() {
  echo ""
  read -p "Proceed with deployment? [y/N]: " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warn "Deployment cancelled by user"
    return 1
  fi
  return 0
}

# log_file_count - Show file count and size
log_file_count() {
  local directory="$1"
  if [ -d "$directory" ]; then
    local count=$(find "$directory" -type f | wc -l | tr -d ' ')
    local size=$(du -sh "$directory" 2>/dev/null | cut -f1)
    log_info "Files to deploy: $count ($size)"
  fi
}

# log_elapsed_time - Show elapsed time
log_elapsed_time() {
  local start_time="$1"
  local end_time=$(date +%s)
  local elapsed=$((end_time - start_time))
  local minutes=$((elapsed / 60))
  local seconds=$((elapsed % 60))

  if [ $minutes -gt 0 ]; then
    log_info "Completed in ${minutes}m ${seconds}s"
  else
    log_info "Completed in ${seconds}s"
  fi
}
