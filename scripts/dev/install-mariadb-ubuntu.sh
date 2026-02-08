#!/usr/bin/env bash
set -euo pipefail

echo "Installing MariaDB via apt..."
sudo apt update
sudo apt install -y mariadb-server mariadb-client
sudo systemctl enable mariadb
sudo systemctl start mariadb

echo "MariaDB installed and started."
