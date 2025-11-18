#!/bin/bash

# SFGGC Website Build Script
# This script builds the static Next.js site for deployment

set -e  # Exit on error

echo "🔨 SFGGC Website Build Script"
echo "=============================="
echo ""

# Get the project root directory (parent of deploy_scripts)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

echo "📁 Project root: $PROJECT_ROOT"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed."
    echo "   Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js version: $NODE_VERSION"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed."
    echo "   Please install npm (usually comes with Node.js)"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm version: $NPM_VERSION"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 node_modules not found. Installing dependencies..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Error: Failed to install dependencies."
        exit 1
    fi
    echo "✅ Dependencies installed"
    echo ""
else
    echo "✅ Dependencies found in node_modules"
    echo ""
fi

# Check if next.config.js exists and has output: 'export'
if [ -f "next.config.js" ]; then
    if grep -q "output.*export" next.config.js || grep -q "output: 'export'" next.config.js; then
        echo "✅ next.config.js is configured for static export"
    else
        echo "⚠️  Warning: next.config.js may not be configured for static export"
        echo "   Expected: output: 'export'"
    fi
    echo ""
else
    echo "⚠️  Warning: next.config.js not found"
    echo ""
fi

# Clean previous build if it exists
if [ -d "out" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf out
    echo "✅ Previous build cleaned"
    echo ""
fi

# Run the build
echo "🔨 Building static site..."
echo "   This may take a few minutes..."
echo ""

npm run build

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Build failed! Please check the errors above."
    exit 1
fi

echo ""
echo "✅ Build completed successfully!"
echo ""

# Validate build output
if [ ! -d "out" ]; then
    echo "❌ Error: Build output directory 'out' not found!"
    echo "   The build may have failed silently."
    exit 1
fi

echo "📊 Build Output Summary:"
echo "========================"

# Count files
HTML_COUNT=$(find out -name "*.html" -type f 2>/dev/null | wc -l | tr -d ' ')
CSS_COUNT=$(find out -name "*.css" -type f 2>/dev/null | wc -l | tr -d ' ')
JS_COUNT=$(find out -name "*.js" -type f 2>/dev/null | wc -l | tr -d ' ')
IMAGE_COUNT=$(find out -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.svg" -o -name "*.webp" \) 2>/dev/null | wc -l | tr -d ' ')

# Calculate total size
TOTAL_SIZE=$(du -sh out 2>/dev/null | cut -f1)

echo "  📄 HTML files: $HTML_COUNT"
echo "  🎨 CSS files: $CSS_COUNT"
echo "  ⚙️  JavaScript files: $JS_COUNT"
echo "  🖼️  Image files: $IMAGE_COUNT"
echo "  📦 Total size: $TOTAL_SIZE"
echo ""

# Check for key files
echo "🔍 Validating key files:"

MISSING_FILES=0

if [ -f "out/index.html" ]; then
    echo "  ✅ index.html"
else
    echo "  ❌ index.html (missing!)"
    MISSING_FILES=$((MISSING_FILES + 1))
fi

if [ -f "out/404.html" ]; then
    echo "  ✅ 404.html"
else
    echo "  ⚠️  404.html (optional, but recommended)"
fi

if [ -d "out/_next" ]; then
    echo "  ✅ _next/ directory (Next.js static assets)"
else
    echo "  ⚠️  _next/ directory (may be expected for some builds)"
fi

if [ -d "out/images" ] || [ -d "out/public/images" ]; then
    echo "  ✅ images/ directory"
else
    echo "  ⚠️  images/ directory (may be in public/)"
fi

echo ""

if [ $MISSING_FILES -gt 0 ]; then
    echo "⚠️  Warning: Some key files are missing. The build may be incomplete."
    echo ""
fi

# List main pages
echo "📄 Generated pages:"
for page in index committee results rules san-francisco; do
    if [ -f "out/${page}.html" ] || [ -f "out/${page}/index.html" ]; then
        echo "  ✅ /${page}"
    else
        echo "  ⚠️  /${page} (not found)"
    fi
done

echo ""
echo "🎉 Build validation complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Review the build output in the 'out' directory"
echo "   2. Test locally (optional):"
echo "      cd out && python3 -m http.server 8000"
echo "      Then visit http://localhost:8000"
echo "   3. Deploy using:"
echo "      ./deploy_scripts/deploy.sh <ssh> <path> <domain>"
echo ""

