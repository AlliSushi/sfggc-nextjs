#!/usr/bin/env bash
set -euo pipefail

FILE_PATH="${1:-/tmp/igbo.xml}"

node scripts/dev/import-igbo-xml.js --file "${FILE_PATH}"
