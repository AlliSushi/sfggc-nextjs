#!/usr/bin/env bash
set -euo pipefail

echo "Installing MariaDB via Homebrew..."
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is not installed. Visit https://brew.sh/ and install it first."
  exit 1
fi

brew install mariadb

# Try to start as a launchd service. This often fails with exit 5 when:
# - Home directory is on an external drive (launchctl bootstrap can fail)
# - The service is already loaded
if brew services start mariadb 2>/dev/null; then
  echo "MariaDB installed and started as a background service."
else
  echo "MariaDB installed, but 'brew services start' failed (common if your home is on an external drive)."
  echo "Start MariaDB when needed with one of:"
  echo "  bash scripts/dev/start-mariadb.sh"
  echo "  brew services run mariadb   # run in a separate terminal; keeps running in foreground"
  echo "  Or: /opt/homebrew/opt/mariadb/bin/mysqld --basedir=/opt/homebrew/opt/mariadb --datadir=/opt/homebrew/var/mysql"
fi

echo ""
echo "If mysql isn't on your PATH, add it:"
echo 'export PATH="/opt/homebrew/opt/mariadb/bin:$PATH"'
