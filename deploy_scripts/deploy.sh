#!/bin/bash

# SFGGC Website Deployment Script for CloudPanel
# This script helps deploy the static Next.js site to your CloudPanel server

echo "🚀 SFGGC Website Deployment Script"
echo "=================================="

# Check if required information is provided
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "❌ Usage: ./deploy_scripts/deploy.sh <ssh_user@server> <domain_path> <domain_name>"
    echo ""
    echo "Example:"
    echo "  ./deploy_scripts/deploy.sh user@your-server.com /home/user/domains/yourdomain.com/public_html yourdomain.com"
    echo ""
    echo "Where:"
    echo "  - ssh_user@server: Your SSH connection string"
    echo "  - domain_path: Path to your website's public_html directory"
    echo "  - domain_name: Your domain name (for testing)"
    echo ""
    exit 1
fi

SSH_CONNECTION="$1"
DOMAIN_PATH="$2"
DOMAIN_NAME="$3"

echo "📋 Deployment Configuration:"
echo "  SSH: $SSH_CONNECTION"
echo "  Path: $DOMAIN_PATH"
echo "  Domain: $DOMAIN_NAME"
echo ""

# Check if out directory exists
if [ ! -d "out" ]; then
    echo "❌ Error: 'out' directory not found!"
    echo "Please run 'npm run build' first to generate static files."
    exit 1
fi

echo "📦 Preparing deployment..."

# Create a temporary directory for deployment
TEMP_DIR="deploy_temp_$(date +%s)"
mkdir -p "$TEMP_DIR"

# Copy all files from out directory
echo "📁 Copying files to temporary directory..."
cp -r out/* "$TEMP_DIR/"

# Create .htaccess for Apache (if needed)
cat > "$TEMP_DIR/.htaccess" << 'EOF'
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
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
</IfModule>
EOF

echo "🔧 Created .htaccess file for Apache optimization"

# Upload files to server
echo "📤 Uploading files to server..."
echo "This may take a few minutes depending on your connection speed..."

# Create backup of existing files (if any)
echo "💾 Creating backup of existing files..."
ssh "$SSH_CONNECTION" "if [ -d '$DOMAIN_PATH' ]; then cp -r '$DOMAIN_PATH' '${DOMAIN_PATH}_backup_$(date +%s)'; fi"

# Upload new files
rsync -avz --delete "$TEMP_DIR/" "$SSH_CONNECTION:$DOMAIN_PATH/"

if [ $? -eq 0 ]; then
    echo "✅ Files uploaded successfully!"
else
    echo "❌ Upload failed! Please check your SSH connection and paths."
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Clean up temporary directory
rm -rf "$TEMP_DIR"

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "🌐 Your website should now be available at:"
echo "   http://$DOMAIN_NAME"
echo "   https://$DOMAIN_NAME (if SSL is configured)"
echo ""
echo "📝 Next steps:"
echo "   1. Test your website in a browser"
echo "   2. Check that all pages load correctly"
echo "   3. Verify that images and CSS are loading"
echo "   4. Test the theme switcher functionality"
echo ""
echo "🔧 If you need to make changes:"
echo "   1. Edit your code locally"
echo "   2. Run 'npm run build'"
echo "   3. Run this deployment script again"
echo ""








