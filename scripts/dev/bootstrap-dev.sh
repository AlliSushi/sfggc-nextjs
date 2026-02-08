#!/usr/bin/env bash
set -euo pipefail

echo "Installing Node dependencies..."
npm install

echo "Starting MariaDB (if available)..."
bash scripts/dev/start-mariadb.sh || true

echo "If MariaDB isn't installed (or start failed, e.g. home on external drive), run:"
echo "  macOS: scripts/dev/install-mariadb-macos.sh"
echo "  Ubuntu: scripts/dev/install-mariadb-ubuntu.sh"

echo "Initialize the portal database schema:"
echo "  bash scripts/dev/init-portal-db.sh"

echo "Import registration XML (optional):"
echo "  bash scripts/dev/import-igbo-xml.sh /tmp/igbo.xml"

echo "Start the frontend:"
echo "  bash scripts/dev/start-frontend.sh"

echo "Done."
