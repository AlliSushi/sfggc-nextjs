#!/bin/bash
# config.sh - Configuration loading and validation for deployment scripts

# load_config - Load configuration from .deployrc file with fallback to .deployrc.example
# Usage: load_config [config_file]
load_config() {
  local config_file="${1:-.deployrc}"
  local actual_file=""

  # If no custom config specified, try .deployrc then fall back to .deployrc.example
  if [ "$config_file" = ".deployrc" ]; then
    if [ -f ".deployrc" ]; then
      actual_file=".deployrc"
      if [ "${VERBOSE:-false}" = true ] || [ "${DEBUG:-false}" = true ]; then
        log_info "Using custom configuration: .deployrc"
      fi
    elif [ -f ".deployrc.example" ]; then
      actual_file=".deployrc.example"
      if [ "${VERBOSE:-false}" = true ] || [ "${DEBUG:-false}" = true ]; then
        log_info "Using default configuration: .deployrc.example"
      fi
    else
      log_warn "Neither .deployrc nor .deployrc.example found"
      log_info "Using built-in defaults"
      return 0
    fi
  else
    # Custom config file specified - must exist
    if [ ! -f "$config_file" ]; then
      log_error "Configuration file not found: $config_file"
      exit 1
    fi
    actual_file="$config_file"
  fi

  # Check file permissions (warn if world-readable, but only for .deployrc not .example)
  if [ -n "$actual_file" ] && [[ "$actual_file" != *.example ]]; then
    local perms=$(stat -f "%Lp" "$actual_file" 2>/dev/null || stat -c "%a" "$actual_file" 2>/dev/null)
    if [ -n "$perms" ] && [ "${perms: -1}" != "0" ]; then
      log_warn "Config file is world-readable: $actual_file"
      log_info "Secure it with: chmod 600 $actual_file"
    fi
  fi

  # Source the configuration file
  if [ -n "$actual_file" ]; then
    # shellcheck disable=SC1090
    source "$actual_file"

    if [ "${DEBUG:-false}" = true ]; then
      log_info "Loaded configuration from: $actual_file"
    fi
  fi
}

# validate_config - Ensure required configuration values are present
validate_config() {
  local errors=0

  # Check SSH configuration
  if [ -z "${DEPLOY_SSH_USER:-}" ]; then
    log_error "DEPLOY_SSH_USER is not set"
    ((errors++))
  fi

  if [ -z "${DEPLOY_SSH_HOST:-}" ]; then
    log_error "DEPLOY_SSH_HOST is not set"
    ((errors++))
  fi

  # Check paths based on deployment mode
  if [ "${DEPLOY_MODE}" = "static" ] || [ "${DEPLOY_MODE}" = "all" ]; then
    if [ -z "${DEPLOY_STATIC_PATH:-}" ]; then
      log_error "DEPLOY_STATIC_PATH is not set"
      ((errors++))
    fi
  fi

  if [ "${DEPLOY_MODE}" = "portal" ] || [ "${DEPLOY_MODE}" = "all" ]; then
    if [ -z "${DEPLOY_PORTAL_PATH:-}" ]; then
      log_error "DEPLOY_PORTAL_PATH is not set"
      ((errors++))
    fi
  fi

  # Show helpful error message if validation fails
  if [ $errors -gt 0 ]; then
    echo ""
    log_error "Configuration validation failed with $errors error(s)"
    echo ""
    log_info "Please set required variables in .deployrc or via CLI flags"
    log_info "See .deployrc.example for reference"
    exit 1
  fi

  if [ "${DEBUG:-false}" = true ]; then
    log_success "Configuration validation passed"
  fi
}

# override_from_cli - Apply CLI flag overrides to configuration
override_from_cli() {
  # Apply CLI overrides if provided
  if [ -n "${CLI_SSH_HOST:-}" ]; then
    DEPLOY_SSH_HOST="$CLI_SSH_HOST"
    if [ "${DEBUG:-false}" = true ]; then
      log_info "Override: DEPLOY_SSH_HOST=$DEPLOY_SSH_HOST"
    fi
  fi

  if [ -n "${CLI_SSH_USER:-}" ]; then
    DEPLOY_SSH_USER="$CLI_SSH_USER"
    if [ "${DEBUG:-false}" = true ]; then
      log_info "Override: DEPLOY_SSH_USER=$DEPLOY_SSH_USER"
    fi
  fi

  if [ -n "${CLI_STATIC_PATH:-}" ]; then
    DEPLOY_STATIC_PATH="$CLI_STATIC_PATH"
    if [ "${DEBUG:-false}" = true ]; then
      log_info "Override: DEPLOY_STATIC_PATH=$DEPLOY_STATIC_PATH"
    fi
  fi

  if [ -n "${CLI_PORTAL_PATH:-}" ]; then
    DEPLOY_PORTAL_PATH="$CLI_PORTAL_PATH"
    if [ "${DEBUG:-false}" = true ]; then
      log_info "Override: DEPLOY_PORTAL_PATH=$DEPLOY_PORTAL_PATH"
    fi
  fi
}

# set_defaults - Set sensible defaults for missing values
set_defaults() {
  # Default SSH user if not set
  DEPLOY_SSH_USER="${DEPLOY_SSH_USER:-goldengateclassic}"

  # Default SSH host if not set
  DEPLOY_SSH_HOST="${DEPLOY_SSH_HOST:-54.70.1.215}"

  # Default domain if not set
  DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-www.goldengateclassic.org}"

  # Default static path if not set
  DEPLOY_STATIC_PATH="${DEPLOY_STATIC_PATH:-/home/$DEPLOY_SSH_USER/htdocs/$DEPLOY_DOMAIN}"

  # Default portal path if not set
  DEPLOY_PORTAL_PATH="${DEPLOY_PORTAL_PATH:-~/htdocs/$DEPLOY_DOMAIN/portal-app}"

  # Default PM2 app name if not set
  DEPLOY_PM2_APP_NAME="${DEPLOY_PM2_APP_NAME:-sfggc-portal}"

  # Portal database defaults
  DEPLOY_DB_HOST="${DEPLOY_DB_HOST:-shared2.cdms8mviovca.us-west-2.rds.amazonaws.com}"
  DEPLOY_DB_PORT="${DEPLOY_DB_PORT:-3306}"
  DEPLOY_DB_NAME="${DEPLOY_DB_NAME:-goldengate}"
  DEPLOY_DB_USER="${DEPLOY_DB_USER:-goldengate}"

  # SMTP defaults
  DEPLOY_SMTP_HOST="${DEPLOY_SMTP_HOST:-email-smtp.us-west-2.amazonaws.com}"
  DEPLOY_SMTP_PORT="${DEPLOY_SMTP_PORT:-587}"
  DEPLOY_SMTP_USER="${DEPLOY_SMTP_USER:-AKIAVU7WKXGTZZA3SOHN}"
  DEPLOY_SMTP_FROM="${DEPLOY_SMTP_FROM:-Golden Gate Classic <noreply@goldengateclassic.org>}"
}

# show_config - Display current configuration (for debugging)
show_config() {
  log_section "CONFIGURATION"

  log_info "SSH: ${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}"
  log_info "Domain: ${DEPLOY_DOMAIN}"

  if [ "${DEPLOY_MODE}" = "static" ] || [ "${DEPLOY_MODE}" = "all" ]; then
    log_info "Static Path: ${DEPLOY_STATIC_PATH}"
  fi

  if [ "${DEPLOY_MODE}" = "portal" ] || [ "${DEPLOY_MODE}" = "all" ]; then
    log_info "Portal Path: ${DEPLOY_PORTAL_PATH}"
    log_info "PM2 App: ${DEPLOY_PM2_APP_NAME}"
    log_info "Database: ${DEPLOY_DB_HOST}:${DEPLOY_DB_PORT}/${DEPLOY_DB_NAME}"
    log_info "SMTP: ${DEPLOY_SMTP_HOST}:${DEPLOY_SMTP_PORT}"
  fi
}
