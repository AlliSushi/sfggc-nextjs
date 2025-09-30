#!/bin/bash

# SFGGC Website Deployment Script - Fixed Version
# Handles permission issues and provides better error handling

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}🚀${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

# Check if required parameters are provided
if [ $# -ne 3 ]; then
    print_error "Usage: $0 <ssh_user@server> <remote_path> <domain>"
    print_error "Example: $0 goldengateclassic@54.70.1.215 /home/goldengateclassic/htdocs/www.goldengateclassic.org www.goldengateclassic.org"
    exit 1
fi

SSH_TARGET="$1"
REMOTE_PATH="$2"
DOMAIN="$3"

echo "🚀 SFGGC Website Deployment Script - Fixed Version"
echo "=================================================="
echo "📋 Deployment Configuration:"
echo "  SSH: $SSH_TARGET"
echo "  Path: $REMOTE_PATH"
echo "  Domain: $DOMAIN"
echo ""

# Check if out directory exists
if [ ! -d "out" ]; then
    print_error "Build directory 'out' not found!"
    print_error "Please run 'npm run build' first to generate the static files."
    exit 1
fi

print_status "Preparing deployment..."

# Create temporary directory for deployment
TEMP_DIR="deploy_temp_$(date +%s)"
mkdir -p "$TEMP_DIR"

print_status "📁 Copying files to temporary directory..."
cp -r out/* "$TEMP_DIR/"

# Create .htaccess file for Apache optimization
print_status "🔧 Creating .htaccess file for Apache optimization..."
cat > "$TEMP_DIR/.htaccess" << 'EOF'
# Apache configuration for SFGGC Next.js static site

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType application/pdf "access plus 1 year"
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# Handle Next.js routing
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /index.html [L]
EOF

print_status "📤 Uploading files to server..."
print_warning "This may take a few minutes depending on your connection speed..."

# First, try to create the remote directory if it doesn't exist
print_status "🔧 Ensuring remote directory exists..."
ssh "$SSH_TARGET" "mkdir -p '$REMOTE_PATH'" || {
    print_warning "Could not create remote directory. This might be a permission issue."
    print_warning "Please ensure the user has write access to the parent directory."
}

# Try to upload with different rsync options to handle permission issues
print_status "📤 Attempting upload with permission handling..."

# Method 1: Try with --no-perms to avoid permission issues
if rsync -avz --no-perms --no-times --delete "$TEMP_DIR/" "$SSH_TARGET:$REMOTE_PATH/" 2>/dev/null; then
    print_success "Upload completed successfully!"
else
    print_warning "Standard rsync failed, trying alternative method..."
    
    # Method 2: Try uploading to a temporary location first
    TEMP_REMOTE_PATH="/tmp/sfggc_deploy_$(date +%s)"
    
    print_status "📤 Uploading to temporary location: $TEMP_REMOTE_PATH"
    if rsync -avz --no-perms --no-times --delete "$TEMP_DIR/" "$SSH_TARGET:$TEMP_REMOTE_PATH/"; then
        print_success "Upload to temporary location successful!"
        
        print_status "🔄 Moving files to final location..."
        if ssh "$SSH_TARGET" "sudo cp -r '$TEMP_REMOTE_PATH'/* '$REMOTE_PATH'/ && sudo chown -R \$(whoami):\$(whoami) '$REMOTE_PATH' && rm -rf '$TEMP_REMOTE_PATH'"; then
            print_success "Files moved to final location successfully!"
        else
            print_error "Failed to move files to final location."
            print_error "You may need to manually move files or check permissions."
            exit 1
        fi
    else
        print_error "Upload failed completely!"
        print_error "Please check:"
        print_error "1. SSH connection and authentication"
        print_error "2. User permissions on the target directory"
        print_error "3. Available disk space on the server"
        exit 1
    fi
fi

# Clean up temporary directory
print_status "🧹 Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

print_success "🎉 Deployment completed successfully!"
print_success "Your website should now be live at: https://$DOMAIN"
print_success "Please test the website to ensure everything is working correctly."

echo ""
print_status "📋 Post-deployment checklist:"
echo "  ✓ Check website loads: https://$DOMAIN"
echo "  ✓ Test all pages and navigation"
echo "  ✓ Verify images and assets load correctly"
echo "  ✓ Test on mobile devices"
echo "  ✓ Check browser console for any errors"
