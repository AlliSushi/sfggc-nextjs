#!/bin/bash
# This script is deprecated - use the unified deployment system instead

echo ""
echo "⚠️  WARNING: This script is deprecated"
echo "    Use: ./deploy_scripts/deploy.sh --static --verbose"
echo ""
echo "Forwarding to new deployment system with verbose output..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/deploy.sh" --static --verbose "$@"
