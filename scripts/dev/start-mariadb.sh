#!/usr/bin/env bash
set -euo pipefail

if command -v brew >/dev/null 2>&1; then
  if brew services list | grep -q "mariadb.*started" || pgrep -qf mysqld; then
    echo "MariaDB is already running."
    exit 0
  fi

  echo "Starting MariaDB via Homebrew..."
  if brew services start mariadb 2>/dev/null; then
    exit 0
  fi

  echo "brew services start failed (common if your home is on an external drive)."
  echo "Falling back to 'brew services run'..."
  if brew services run mariadb 2>/dev/null; then
    # brew services run doesn't register with launchctl, so the status
    # may show as "none" even though mysqld is running. Verify the process.
    sleep 1
    if pgrep -qf mysqld; then
      echo "MariaDB is running (via brew services run)."
      exit 0
    fi
  fi

  echo "Could not start MariaDB automatically."
  echo "Run mysqld directly in a separate terminal:"
  if command -v /opt/homebrew/opt/mariadb/bin/mysqld >/dev/null 2>&1; then
    echo '  /opt/homebrew/opt/mariadb/bin/mysqld --basedir=/opt/homebrew/opt/mariadb --datadir=/opt/homebrew/var/mysql'
  fi
  exit 1
fi

if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet mariadb; then
    echo "MariaDB is already running."
  else
    echo "Starting MariaDB via systemctl..."
    sudo systemctl start mariadb
  fi
  exit 0
fi

echo "Could not detect brew or systemctl. Start MariaDB manually."
