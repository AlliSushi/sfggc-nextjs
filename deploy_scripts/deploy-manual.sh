#!/bin/bash

# Manual SFGGC Website Deployment Script
# This script provides step-by-step manual deployment instructions

echo "🚀 SFGGC Manual Deployment Guide"
echo "================================="

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "❌ Usage: ./deploy_scripts/deploy-manual.sh <ssh_user@server> <domain_path> <domain_name>"
    echo ""
    echo "Example:"
    echo "  ./deploy_scripts/deploy-manual.sh user@your-server.com /home/user/domains/yourdomain.com/public_html yourdomain.com"
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

echo "🔍 Step 1: Testing SSH connection..."
ssh "$SSH_CONNECTION" "echo 'SSH connection successful' && pwd && whoami"

if [ $? -ne 0 ]; then
    echo "❌ SSH connection failed! Please check your credentials."
    exit 1
fi

echo "✅ SSH connection successful!"
echo ""

echo "🔍 Step 2: Checking destination directory..."
ssh "$SSH_CONNECTION" "ls -la '$DOMAIN_PATH'"

if [ $? -ne 0 ]; then
    echo "⚠️  Directory doesn't exist or no permission. Let's create it..."
    ssh "$SSH_CONNECTION" "mkdir -p '$DOMAIN_PATH'"
    ssh "$SSH_CONNECTION" "chmod 755 '$DOMAIN_PATH'"
    echo "✅ Directory created and permissions set."
else
    echo "✅ Directory exists and is accessible."
fi

echo ""
echo "🔍 Step 3: Creating backup..."
ssh "$SSH_CONNECTION" "if [ -d '$DOMAIN_PATH' ] && [ \"\$(ls -A '$DOMAIN_PATH')\" ]; then cp -r '$DOMAIN_PATH' '${DOMAIN_PATH}_backup_\$(date +%s)'; echo 'Backup created'; else echo 'No existing files to backup'; fi"

echo ""
echo "📦 Step 4: Preparing files for upload..."

# Create a compressed archive
echo "Creating compressed archive..."
tar -czf sfggc-website.tar.gz -C out .

if [ $? -eq 0 ]; then
    echo "✅ Archive created: sfggc-website.tar.gz"
else
    echo "❌ Failed to create archive"
    exit 1
fi

echo ""
echo "📤 Step 5: Uploading files..."

# Upload the archive
scp sfggc-website.tar.gz "$SSH_CONNECTION:/tmp/"

if [ $? -eq 0 ]; then
    echo "✅ Archive uploaded to server"
else
    echo "❌ Upload failed!"
    rm -f sfggc-website.tar.gz
    exit 1
fi

echo ""
echo "🔧 Step 6: Extracting files on server..."

# Extract files on the server
ssh "$SSH_CONNECTION" "cd '$DOMAIN_PATH' && tar -xzf /tmp/sfggc-website.tar.gz && rm /tmp/sfggc-website.tar.gz"

if [ $? -eq 0 ]; then
    echo "✅ Files extracted successfully"
else
    echo "❌ Failed to extract files"
    exit 1
fi

echo ""
echo "🔧 Step 7: Setting permissions..."

# Set proper permissions
ssh "$SSH_CONNECTION" "chmod -R 755 '$DOMAIN_PATH' && chown -R \$(whoami):\$(whoami) '$DOMAIN_PATH'"

echo ""
echo "🔧 Step 8: Creating .htaccess file..."

# Create .htaccess file
ssh "$SSH_CONNECTION" "cat > '$DOMAIN_PATH/.htaccess' << 'EOF'
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
    ExpiresByType text/css \"access plus 1 year\"
    ExpiresByType application/javascript \"access plus 1 year\"
    ExpiresByType image/png \"access plus 1 year\"
    ExpiresByType image/jpg \"access plus 1 year\"
    ExpiresByType image/jpeg \"access plus 1 year\"
    ExpiresByType image/gif \"access plus 1 year\"
    ExpiresByType image/svg+xml \"access plus 1 year\"
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection \"1; mode=block\"
</IfModule>
EOF"

echo "✅ .htaccess file created"

# Clean up local archive
rm -f sfggc-website.tar.gz

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








