# SFGGC Website Deployment Guide

This guide will help you deploy your SFGGC Next.js static website to a CloudPanel server.

## Prerequisites

- SSH access to your CloudPanel server
- Domain name configured in CloudPanel
- Basic knowledge of command line

## SSH Key Setup (Recommended)

For passwordless deployment, set up SSH key authentication. This allows the deployment script to run without prompting for a password each time.

### Option 1: Automated Setup (Recommended)

Use the provided SSH setup script:

```bash
./deploy_scripts/setup-ssh.sh <ssh_user@server> <server_alias>
```

**Example:**
```bash
./deploy_scripts/setup-ssh.sh jfuggc@54.70.1.215 sfggc-server
```

The script will:
1. Generate an SSH key pair (if one doesn't exist)
2. Configure your SSH config file with a friendly alias
3. Help you add the public key to the server
4. Test the passwordless connection

**After running the script**, you'll need to add the public key to your server. The script will display your public key and provide instructions.

### Option 2: Manual SSH Key Setup

If you prefer to set up SSH keys manually:

#### Step 1: Generate SSH Key

```bash
# Generate a new SSH key
ssh-keygen -t ed25519 -C "sfggc-deployment" -f ~/.ssh/id_ed25519_sfggc -N ""
```

#### Step 2: Add to SSH Config

Create or edit `~/.ssh/config`:

```bash
Host sfggc-server
    HostName 54.70.1.215
    User jfuggc
    IdentityFile ~/.ssh/id_ed25519_sfggc
    IdentitiesOnly yes
```

Set proper permissions:
```bash
chmod 600 ~/.ssh/config
```

#### Step 3: Add Public Key to Server

Display your public key:
```bash
cat ~/.ssh/id_ed25519_sfggc.pub
```

Add it to the server (you'll be prompted for your password once):
```bash
ssh jfuggc@54.70.1.215 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
```

Replace `YOUR_PUBLIC_KEY_HERE` with the output from `cat ~/.ssh/id_ed25519_sfggc.pub`.

#### Step 4: Test Connection

Test passwordless SSH:
```bash
ssh sfggc-server "echo 'Connection successful'"
```

If successful, you won't be prompted for a password.

### Using SSH Keys with Deployment

Once SSH keys are set up, you can use the server alias in the deployment script:

```bash
./deploy_scripts/deploy.sh sfggc-server /home/jfuggc/htdocs/www.goldengateclassic.org www.goldengateclassic.org
```

Or use the full SSH connection string:
```bash
./deploy_scripts/deploy.sh jfuggc@54.70.1.215 /home/jfuggc/htdocs/www.goldengateclassic.org www.goldengateclassic.org
```

## Step-by-Step Deployment

### 1. Gather Required Information

Before deploying, you need:

- **SSH Connection**: Your SSH login (e.g., `user@your-server.com`)
- **Domain Path**: The path to your website's public_html directory (usually `/home/username/domains/yourdomain.com/public_html`)
- **Domain Name**: Your website's domain name

### 2. Prepare Your Local Environment

Make sure you have the latest code and dependencies:

**Option 1: Use the build script (Recommended)**

The build script automatically checks dependencies and builds the site:

```bash
./deploy_scripts/build.sh
```

The script will:
- Check for Node.js and npm
- Install dependencies if needed (`npm install`)
- Validate `next.config.js` configuration
- Resize oversized source images (wider than 800px) using macOS `sips`
- Build the static site (`npm run build`)
- Validate the build output
- Display build statistics

**Option 2: Manual build**

```bash
# Install dependencies (if not already done)
npm install

# Build the static site
npm run build
```

**Verify the build:**

After building, check that the `out` directory was created:

```bash
ls -la out/
```

You should see:
- `index.html` - Homepage
- `404.html` - 404 error page
- `_next/` - Next.js static assets
- Other HTML pages (committee.html, results.html, etc.)

### 3. Deploy Using the Deployment Script

Use the provided deployment script:

```bash
./deploy_scripts/deploy.sh <ssh_user@server> <domain_path> <domain_name>
```

**Example:**
```bash
./deploy_scripts/deploy.sh user@myserver.com /home/user/domains/sfggc.com/public_html sfggc.com
```

**Options:**

```bash
# Skip confirmation prompt (useful for CI/CD)
./deploy_scripts/deploy.sh --yes

# Alternative syntax
./deploy_scripts/deploy.sh -y
```

The `--yes` (or `-y`) flag skips the "Do you want to deploy?" confirmation prompt, making the script suitable for automated deployments.

### 4. Manual Deployment (Alternative)

If you prefer to deploy manually:

#### Step 4a: Connect to Your Server
```bash
ssh user@your-server.com
```

#### Step 4b: Navigate to Your Domain Directory
```bash
cd /home/username/domains/yourdomain.com/public_html
```

#### Step 4c: Create Backup (Optional but Recommended)
```bash
cp -r public_html public_html_backup_$(date +%s)
```

#### Step 4d: Upload Files from Your Local Machine
From your local project directory:
```bash
# Upload all files from the 'out' directory
rsync -avz --delete out/ user@your-server.com:/home/username/domains/yourdomain.com/public_html/
```

### 5. Configure Web Server (if needed)

#### For Apache (most common with CloudPanel):

The deployment script automatically creates a `.htaccess` file, but if you need to create or modify it manually, add this to your domain's public_html directory:

```apache
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
```

#### For Nginx:

If you're using Nginx instead of Apache, you'll need to configure nginx to serve the static files. Unlike Apache, nginx doesn't use `.htaccess` files and requires server configuration.

**If you're using CloudPanel:**
- See [CLOUDPANEL_NGINX_GUIDE.md](CLOUDPANEL_NGINX_GUIDE.md) for step-by-step instructions on updating nginx configuration in CloudPanel
- See [CLOUDPANEL_STATIC_NGINX.md](CLOUDPANEL_STATIC_NGINX.md) if you need to convert from proxy configuration to static file serving

**For manual nginx configuration:**
- See [NGINX_SETUP.md](NGINX_SETUP.md) for complete nginx configuration instructions

**For ISP-controlled nginx (no direct SSH access to nginx):**
- See the [Nginx Configuration Management](#nginx-configuration-management) section below for the copy/paste workflow

### 6. Test Your Deployment

1. **Visit your website**: Open your domain in a browser
2. **Check all pages**: Navigate through all sections
3. **Test responsiveness**: Check on mobile and desktop
4. **Verify theme switching**: Test the dark/light theme toggle
5. **Check images**: Ensure all images load correctly
6. **Test PDF downloads**: Verify results PDFs are accessible

### 7. Troubleshooting

#### Common Issues:

**Build failures:**
- Ensure Node.js is installed: `node --version`
- Ensure npm is installed: `npm --version`
- Try cleaning and rebuilding: `rm -rf out node_modules && npm install && ./deploy_scripts/build.sh`
- Check for syntax errors in your code
- Verify `next.config.js` has `output: 'export'` configured
- Check build logs for specific error messages

**Build output missing files:**
- Verify the build completed successfully (check for errors)
- Ensure all pages are properly exported
- Check that images are in the `public/` directory
- Verify `next.config.js` configuration

**SSH Authentication Issues:**
- If prompted for password, SSH keys may not be set up correctly
- Run `./deploy_scripts/setup-ssh.sh` to set up SSH keys
- Test connection: `ssh <server_alias> "echo Connection successful"`
- Verify key is in server's `~/.ssh/authorized_keys` file

**Files not uploading:**
- Check SSH connection: `ssh user@your-server.com` or `ssh <server_alias>`
- Verify domain path exists
- Ensure you have write permissions

**Website not loading:**
- Check if files are in the correct directory
- Verify domain DNS settings
- Check CloudPanel domain configuration

**Images not loading:**
- Verify image paths in the uploaded files
- Check file permissions
- Ensure images are in the correct directories

**CSS/JS not loading:**
- Check if static files are in the `_next/static/` directory
- Verify file permissions
- Check browser console for errors

**Nginx errors or 502/503 errors:**
- If using nginx, check nginx configuration (see [NGINX_SETUP.md](NGINX_SETUP.md))
- Verify nginx is configured to serve static files, not proxy to a Node.js app
- Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- For ISP-controlled nginx, see [Nginx Configuration Management](#nginx-configuration-management)

### 8. Updating Your Website

To update your website:

1. **Make changes locally**
2. **Build the site**: 
   - Use the build script: `./deploy_scripts/build.sh`
   - Or manually: `npm run build`
3. **Deploy again**: Run the deployment script or manual process
4. **Test the changes**

### 9. Backup Strategy

- The deployment script automatically creates backups
- Manual backups are stored in `public_html_backup_TIMESTAMP`
- Consider setting up automated backups in CloudPanel

## File Structure After Deployment

Your server's public_html directory should contain:

```
public_html/
├── index.html              # Homepage
├── 404.html               # 404 error page
├── committee/             # Committee page
├── results/               # Results page
├── rules/                 # Rules page
├── san-francisco/         # San Francisco page
├── images/                # Static images
├── results/               # PDF files
├── _next/                 # Next.js static assets
│   ├── static/
│   │   ├── css/           # CSS files
│   │   ├── chunks/        # JavaScript chunks
│   │   └── media/         # Optimized images
│   └── ...
└── .htaccess              # Apache configuration
```

## Support

If you encounter issues:

1. Check the CloudPanel logs
2. Verify file permissions
3. Test with a simple HTML file first
4. Contact your hosting provider if needed

## Nginx Configuration Management

This section applies when you do NOT have direct SSH access to nginx (ISP-controlled hosting with web-based control panel).

### Overview

**Configuration File Location:** `/Volumes/Keiki/Users/jfunson/source/Cursor/sfggc/sfggc-nextjs/backend/config/vhost.txt`

This file contains the complete nginx vhost configuration for the SFGGC website, including both the static site and portal application proxy settings.

### When to Update Nginx Configuration

You need to update nginx configuration when:
- Adding new portal routes or API endpoints
- Changing proxy settings (port, headers, timeouts)
- Modifying caching rules for static assets
- Adding new location blocks or redirects
- Troubleshooting 502/503 errors on the portal

### Configuration Management Workflow

Since you cannot run nginx commands directly (no `nginx -t`, `systemctl reload nginx`, etc.), use this workflow:

**1. Edit Configuration Locally**

```bash
# Navigate to the config directory
cd /Volumes/Keiki/Users/jfunson/source/Cursor/sfggc/sfggc-nextjs/backend/config

# Edit the vhost configuration file
nano vhost.txt  # or vim, code, etc.
```

**2. Copy Configuration to Clipboard**

```bash
# macOS
cat vhost.txt | pbcopy

# Linux (requires xclip)
cat vhost.txt | xclip -selection clipboard

# Windows (WSL)
cat vhost.txt | clip.exe

# Manual alternative: Select all text in editor and copy
```

**3. Paste in ISP Control Panel**

1. Log into your ISP's web-based control panel
2. Navigate to the nginx/vhost configuration section for your domain
3. Clear the existing configuration
4. Paste the clipboard contents
5. Save the configuration

The ISP control panel will automatically:
- Validate the nginx syntax
- Reload nginx if valid
- Display errors if invalid

**4. Test the Changes**

```bash
# Test static site
curl -I https://www.goldengateclassic.org/

# Test portal (should proxy to Node.js on port 3000)
curl -I https://www.goldengateclassic.org/portal

# Test portal API
curl -I https://www.goldengateclassic.org/api/portal/health
```

**5. Commit Configuration Changes**

```bash
# Stage the vhost.txt file
git add backend/config/vhost.txt

# Commit with descriptive message
git commit -m "Update nginx config: [describe changes]"

# Push to repository
git push origin main
```

### Configuration File Structure

The `backend/config/vhost.txt` file contains four main sections:

**Upstream Block (before `server {}`):**
```nginx
upstream portal_backend {
  server 127.0.0.1:3000;
  keepalive 16;   # persistent connections, saves 20-50ms/request
}
```

The `keepalive 16` directive maintains persistent connections between nginx and Node.js, avoiding TCP handshake overhead on every request. This requires `proxy_set_header Connection ""` (empty string, not `'upgrade'`) in all proxied location blocks.

**SSL and Server Configuration:**
- SSL certificates (CloudPanel placeholders)
- HTTP to HTTPS redirect
- Basic server settings

**Portal Application (CRITICAL -- read the warning below):**

> **WARNING:** All four portal location blocks MUST use the `^~` modifier. Without it, the regex location `~* \.(js|css|...)$` overrides the prefix locations for any URL ending in `.js` or `.css`. This causes ALL Next.js JavaScript bundles to return 404, breaking React hydration and rendering the entire portal non-functional (pages load but interactive elements are invisible).

```nginx
# Portal pages -- ^~ prevents regex override
location ^~ /portal {
  proxy_pass http://portal_backend;
  # ... proxy headers ...
}

# Portal API routes
location ^~ /api/portal {
  proxy_pass http://portal_backend;
  # ... proxy headers ...
}

# Next.js static assets -- served directly from disk (bypasses Node.js)
location ^~ /_next/static {
  alias /home/.../portal-app/.next/static;
  expires 1y;
  add_header Cache-Control "public, immutable";
}

# Next.js dynamic requests
location ^~ /_next {
  proxy_pass http://portal_backend;
  # ... proxy headers ...
}
```

**Static Site Configuration:**
- `location /` with `try_files` for static pages
- `location ~*` regex for caching images, CSS, JS (this is the regex that conflicts without `^~`)
- 404 error handling

### Common Configuration Tasks

**Add a New Portal Route:**
No changes needed. The existing `/portal` location block catches all portal routes.

**Change Portal Port:**
If the Node.js app runs on a different port, update the `upstream` block (not individual location blocks):
```nginx
upstream portal_backend {
  server 127.0.0.1:3001;  # Changed from 3000
  keepalive 16;
}
```

**Add Custom Headers:**
```nginx
location ^~ /portal {
  proxy_pass http://portal_backend;
  # ... existing headers ...
  proxy_set_header X-Custom-Header "value";
}
```

**Increase Timeout for Long Requests:**
```nginx
location ^~ /api/portal {
  proxy_pass http://portal_backend;
  # ... existing headers ...
  proxy_read_timeout 300s;
  proxy_connect_timeout 300s;
}
```

**IMPORTANT:** When editing location blocks, always preserve the `^~` modifier. Removing it will break the portal. See the warning in [Configuration File Structure](#configuration-file-structure) above.

### Nginx Proxy Header Inheritance

**Critical Rule:** When you add any `proxy_set_header` directive inside a `location` block, ALL `proxy_set_header` directives inherited from the parent `server` block are lost. Nginx does not merge headers between scopes -- the child block completely replaces the parent's headers.

**What this means in practice:** Every proxy `location` block must explicitly define ALL required headers, even if the parent scope already defines them. You cannot rely on headers "flowing down" from the server-level configuration.

**Required headers for every proxy location:**
```nginx
location ^~ /portal {
    proxy_pass http://portal_backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
}
```

**If you forget even one header:**
- Missing `Host`: Backend receives wrong hostname, routing fails
- Missing `X-Real-IP` / `X-Forwarded-For`: Audit logs record `127.0.0.1` instead of the real client IP
- Missing `X-Forwarded-Proto`: Backend cannot detect HTTPS, may generate insecure URLs
- Missing `Connection ""`: Keepalive connections to the upstream break

**When adding a new proxy location block,** always copy the full set of `proxy_set_header` directives from an existing working block. Do not assume any headers are inherited.

### What NOT to Do

**Do not attempt these commands** (they require direct SSH access to nginx):
```bash
# These will fail without nginx permissions:
nginx -t                    # Test configuration syntax
systemctl reload nginx      # Reload nginx
systemctl restart nginx     # Restart nginx
sudo vim /etc/nginx/...     # Edit nginx files directly
```

### Troubleshooting

**Configuration Rejected by ISP Panel:**
- Check for syntax errors (missing semicolons, braces)
- Verify CloudPanel placeholders are preserved: `{{root}}`, `{{ssl_certificate}}`, etc.
- Test locally if you have nginx installed: `nginx -t -c vhost.txt` (optional, won't catch placeholder issues)

**Portal Returns 502 Bad Gateway:**
1. Check that Node.js app is running: `ssh server "pm2 status sfggc-portal"`
2. Verify proxy_pass port matches app port (default: 3000)
3. Check app logs: `ssh server "pm2 logs sfggc-portal"`

**Static Site Works But Portal Doesn't:**
1. Verify the portal proxy configuration is present in `backend/config/vhost.txt`
2. Check that Node.js app is running (see above)
3. Test portal URL directly: `curl -v https://domain/portal`

**Portal Pages Load But Menus/Forms Are Missing (No Interactivity):**
1. Open browser DevTools Network tab and check for 404 errors on `/_next/static/chunks/*.js` files
2. If JS files return 404, the `^~` modifier is likely missing from the nginx location blocks
3. Verify all portal location blocks use `^~`: `location ^~ /portal`, `location ^~ /_next/static`, etc.
4. This is the most common nginx misconfiguration -- see the WARNING in [Configuration File Structure](#configuration-file-structure)

**Changes Not Taking Effect:**
1. Verify you saved changes in ISP control panel
2. Check if ISP panel reported errors during save
3. Wait 30-60 seconds for nginx reload to complete
4. Clear browser cache and test again

### Version Control Best Practices

**Always commit configuration changes:**
```bash
# Good commit messages:
git commit -m "Add timeout settings for portal API routes"
git commit -m "Update proxy port from 3000 to 3001"
git commit -m "Add caching headers for portal assets"

# Bad commit messages:
git commit -m "Update config"
git commit -m "Fix nginx"
```

**Document breaking changes:**
If your nginx config change requires a corresponding code change, document it in the commit message:
```bash
git commit -m "Change portal API prefix from /api/portal to /api/v1

BREAKING CHANGE: Requires updating API route files:
- src/pages/api/portal/*.js -> src/pages/api/v1/*.js
- Update all fetch() calls in frontend components"
```

### Reference Configuration

The current production configuration is maintained in:
- **File:** `/Volumes/Keiki/Users/jfunson/source/Cursor/sfggc/sfggc-nextjs/backend/config/vhost.txt`
- **Repository:** `sfggc-nextjs`
- **Branch:** `main`

Always pull the latest version before making changes:
```bash
git pull origin main
```

## Portal Backend

The portal (admin dashboard + participant login) runs as a **Next.js server application**, not a static site. It requires Node.js, MariaDB, and SMTP access on the server.

For complete portal deployment instructions, see [PORTAL_DEPLOYMENT.md](PORTAL_DEPLOYMENT.md).

## Security Notes

- Keep your SSH keys secure
- Regularly update your server
- Monitor your website for issues
- Consider setting up SSL certificates through CloudPanel








