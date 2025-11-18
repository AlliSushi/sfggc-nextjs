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

```bash
# Install dependencies (if not already done)
npm install

# Build the static site
npm run build
```

### 3. Deploy Using the Deployment Script

Use the provided deployment script:

```bash
./deploy_scripts/deploy.sh <ssh_user@server> <domain_path> <domain_name>
```

**Example:**
```bash
./deploy_scripts/deploy.sh user@myserver.com /home/user/domains/sfggc.com/public_html sfggc.com
```

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

### 6. Test Your Deployment

1. **Visit your website**: Open your domain in a browser
2. **Check all pages**: Navigate through all sections
3. **Test responsiveness**: Check on mobile and desktop
4. **Verify theme switching**: Test the dark/light theme toggle
5. **Check images**: Ensure all images load correctly
6. **Test PDF downloads**: Verify results PDFs are accessible

### 7. Troubleshooting

#### Common Issues:

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

### 8. Updating Your Website

To update your website:

1. **Make changes locally**
2. **Build the site**: `npm run build`
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

## Security Notes

- Keep your SSH keys secure
- Regularly update your server
- Monitor your website for issues
- Consider setting up SSL certificates through CloudPanel








