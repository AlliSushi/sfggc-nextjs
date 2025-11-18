# Server Setup Guide for SFGGC Website Deployment

## Permission Issues Resolution

The deployment is failing due to permission issues. Here are several solutions to fix this:

### Option 1: Fix Directory Permissions (Recommended)

SSH into your server and run these commands:

```bash
# SSH into your server
ssh goldengateclassic@54.70.1.215

# Navigate to the parent directory
cd /home/goldengateclassic/htdocs

# Check current permissions
ls -la

# Fix ownership of the website directory
sudo chown -R goldengateclassic:goldengateclassic www.goldengateclassic.org

# Set proper permissions
sudo chmod -R 755 www.goldengateclassic.org

# Ensure the user can write to the directory
sudo chmod 775 www.goldengateclassic.org
```

### Option 2: Use Sudo for Deployment

If you have sudo access, you can modify the deployment to use sudo:

```bash
# Create a deployment script that uses sudo
ssh goldengateclassic@54.70.1.215 "sudo mkdir -p /home/goldengateclassic/htdocs/www.goldengateclassic.org"
ssh goldengateclassic@54.70.1.215 "sudo chown -R goldengateclassic:goldengateclassic /home/goldengateclassic/htdocs/www.goldengateclassic.org"
```

### Option 3: Deploy to a Different Directory

If you can't fix permissions on the current directory, deploy to a temporary location and then move files:

```bash
# Deploy to a temporary directory first
./deploy_scripts/deploy.sh goldengateclassic@54.70.1.215 /tmp/sfggc_deploy www.goldengateclassic.org

# Then manually move files (requires sudo)
ssh goldengateclassic@54.70.1.215 "sudo cp -r /tmp/sfggc_deploy/* /home/goldengateclassic/htdocs/www.goldengateclassic.org/"
```

### Option 4: Use CloudPanel File Manager

1. Log into your CloudPanel dashboard
2. Navigate to File Manager
3. Go to `/home/goldengateclassic/htdocs/www.goldengateclassic.org`
4. Check the permissions and ownership
5. Set the owner to `goldengateclassic` and group to `goldengateclassic`
6. Set permissions to `755` for directories and `644` for files

## Testing the Fix

After applying one of the above solutions, test the deployment:

```bash
# Use the deployment script (run from project root)
./deploy_scripts/deploy.sh goldengateclassic@54.70.1.215 /home/goldengateclassic/htdocs/www.goldengateclassic.org www.goldengateclassic.org
```

## Alternative: Manual Upload

If automated deployment continues to fail, you can manually upload the files:

1. **Build the site locally:**
   ```bash
   npm run build
   ```

2. **Create a zip file:**
   ```bash
   cd out
   zip -r ../sfggc-website.zip .
   cd ..
   ```

3. **Upload via CloudPanel:**
   - Log into CloudPanel
   - Go to File Manager
   - Navigate to `/home/goldengateclassic/htdocs/www.goldengateclassic.org`
   - Upload the zip file
   - Extract it in the directory

4. **Set up .htaccess:**
   - Create a `.htaccess` file in the root directory with the content from the deployment script

## Troubleshooting

### Check Current Permissions
```bash
ssh goldengateclassic@54.70.1.215 "ls -la /home/goldengateclassic/htdocs/"
```

### Check Disk Space
```bash
ssh goldengateclassic@54.70.1.215 "df -h"
```

### Check User Groups
```bash
ssh goldengateclassic@54.70.1.215 "groups goldengateclassic"
```

### Test SSH Access
```bash
ssh goldengateclassic@54.70.1.215 "whoami && pwd"
```

## Common Issues and Solutions

1. **"Operation not permitted"**: Directory ownership or permissions issue
2. **"Permission denied"**: User doesn't have write access
3. **"No space left on device"**: Server is out of disk space
4. **"Connection refused"**: SSH service not running or firewall blocking
5. **Nginx errors (502/503)**: Nginx may be configured to proxy instead of serving static files
   - See [NGINX_SETUP.md](deploy_docs/NGINX_SETUP.md) for nginx configuration
   - See [CLOUDPANEL_STATIC_NGINX.md](deploy_docs/CLOUDPANEL_STATIC_NGINX.md) for CloudPanel-specific fixes

## Next Steps

1. Try Option 1 (fix permissions) first
2. If that doesn't work, try the deployment script again
3. If still failing, use manual upload via CloudPanel
4. Test the website thoroughly after deployment

## Note

This guide contains example server information. Replace the server details (IP address, username, paths) with your actual server configuration when following these instructions.







