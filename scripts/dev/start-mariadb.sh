#!/usr/bin/env bash
set -euo pipefail

if command -v brew >/dev/null 2>&1; then
  if brew services list | grep -q "mariadb.*started"; then
    echo "MariaDB is already running (mariadb)."
    exit 0
  fi

  echo "Starting MariaDB via Homebrew..."
  if brew services start mariadb; then
    exit 0
  fi

  echo "brew services start failed (common if your home is on an external drive)."
  echo "Run MariaDB in the foreground in a separate terminal:"
  echo "  brew services run mariadb"
  echo "Or run mysqld directly:"
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
