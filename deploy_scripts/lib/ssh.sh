#!/bin/bash
# ssh.sh - SSH connection helpers for deployment

# ssh_command - Execute command on server (respects dry-run)
# Usage: ssh_command "command to run"
ssh_command() {
  local command="$1"

  if [ "${DRY_RUN:-false}" = true ]; then
    if [ "${VERBOSE:-false}" = true ]; then
      log_info "  SSH command: $command"
    fi
    return 0  # Simulate success
  fi

  ssh "${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}" "$command"
}

# scp_file - Copy file to server (respects dry-run)
# Usage: scp_file "local_file" "remote_path"
scp_file() {
  local local_file="$1"
  local remote_path="$2"

  if [ "${DRY_RUN:-false}" = true ]; then
    if [ "${VERBOSE:-false}" = true ]; then
      log_info "  Would copy: $local_file -> ${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}:$remote_path"
    fi
    return 0
  fi

  scp "$local_file" "${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}:$remote_path"
}

# rsync_files - Sync directory to server (respects dry-run)
# Usage: rsync_files "local_dir" "remote_dir" ["exclude_patterns"]
rsync_files() {
  local local_dir="$1"
  local remote_dir="$2"
  local exclude_patterns="$3"

  local rsync_cmd="rsync -avz --delete"

  # Add exclude patterns if provided
  if [ -n "$exclude_patterns" ]; then
    while IFS= read -r pattern; do
      rsync_cmd="$rsync_cmd --exclude='$pattern'"
    done <<< "$exclude_patterns"
  fi

  rsync_cmd="$rsync_cmd \"$local_dir/\" \"${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}:$remote_dir\""

  if [ "${DRY_RUN:-false}" = true ]; then
    if [ "${VERBOSE:-false}" = true ]; then
      log_info "  Rsync command: $rsync_cmd"
    fi
    return 0
  fi

  eval "$rsync_cmd"
}

# test_ssh_connection - Test SSH connectivity
test_ssh_connection() {
  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would test SSH connection"
    return 0
  fi

  ssh -o BatchMode=yes -o ConnectTimeout=10 "${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}" 'exit' 2>/dev/null
  return $?
}

# create_remote_backup - Create timestamped backup on server
# Usage: create_remote_backup "directory_to_backup"
create_remote_backup() {
  local dir_to_backup="$1"
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_dir="${dir_to_backup}.backup.$timestamp"

  if [ "${DRY_RUN:-false}" = true ]; then
    log_dry_run "Would create backup: $backup_dir"
    return 0
  fi

  # Check if directory exists before backing up
  if ssh_command "[ -d \"$dir_to_backup\" ]" 2>/dev/null; then
    log_step "Creating backup: $backup_dir"
    ssh_command "cp -r \"$dir_to_backup\" \"$backup_dir\""
    return $?
  else
    log_info "No existing deployment to backup"
    return 0
  fi
}

# check_remote_file_exists - Check if file exists on server
# Usage: check_remote_file_exists "remote_path"
check_remote_file_exists() {
  local remote_path="$1"

  if [ "${DRY_RUN:-false}" = true ]; then
    return 0  # Assume exists in dry-run
  fi

  # Expand tilde by executing the test without quotes around the path
  # This allows the remote shell to expand ~ to the home directory
  ssh_command "[ -f $remote_path ]" 2>/dev/null
  return $?
}

# check_remote_dir_exists - Check if directory exists on server
# Usage: check_remote_dir_exists "remote_path"
check_remote_dir_exists() {
  local remote_path="$1"

  if [ "${DRY_RUN:-false}" = true ]; then
    return 0  # Assume exists in dry-run
  fi

  # Expand tilde by executing the test without quotes around the path
  # This allows the remote shell to expand ~ to the home directory
  ssh_command "[ -d $remote_path ]" 2>/dev/null
  return $?
}
