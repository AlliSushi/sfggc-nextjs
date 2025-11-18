# How to Update Nginx Configuration in CloudPanel

## Step-by-Step Guide

### Step 1: Log into CloudPanel
1. Open your web browser
2. Navigate to your CloudPanel URL (usually `https://your-server-ip:8443` or your CloudPanel domain)
3. Log in with your credentials

### Step 2: Navigate to Your Site
1. In the left sidebar, click on **"Sites"** (or "Websites")
2. Find and click on your domain: **www1.goldengateclassic.org**
3. This will open the site management page

### Step 3: Access Nginx Settings
CloudPanel has different ways to access nginx configuration depending on the version:

#### Option A: Direct Nginx Tab
Look for a tab or menu item labeled:
- **"Nginx"**
- **"Nginx Config"**
- **"Web Server"**
- **"Server Configuration"**

#### Option B: Advanced Settings
1. Look for **"Advanced"** or **"Settings"** tab
2. Inside, find **"Nginx"** or **"Custom Nginx Config"**
3. Or look for **"Custom Directives"** or **"Custom Configuration"**

#### Option C: Edit Configuration File
1. Look for **"File Manager"** or **"Files"** in the left sidebar
2. Navigate to `/etc/nginx/sites-available/` or `/etc/nginx/conf.d/`
3. Find the configuration file for your domain
4. CloudPanel may have a **"Edit"** button next to the file

### Step 4: Add or Modify Configuration

Once you find the nginx configuration area, you need to add or modify these directives:

#### If there's a "Custom Directives" or "Custom Nginx Config" text box:

**Paste this configuration:**

```nginx
# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript 
           application/x-javascript application/xml+rss 
           application/javascript application/json 
           image/svg+xml;

# Security headers
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;

# Cache static assets (images, fonts, etc.)
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Serve Next.js static files with long cache
location /_next/static {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Handle Next.js client-side routing (CRITICAL!)
location / {
    try_files $uri $uri/ $uri.html /index.html;
}

# Handle 404 errors with Next.js custom page
error_page 404 /404.html;
location = /404.html {
    internal;
}

# Deny access to hidden files
location ~ /\. {
    deny all;
    access_log off;
    log_not_found off;
}
```

#### If you're editing the full configuration file:

Find the `server` block for your domain and make sure it includes:

```nginx
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name www1.goldengateclassic.org www.goldengateclassic.org goldengateclassic.org;
    
    # Make sure root points to your deployment directory
    root /home/goldengateclassic/htdocs/www.goldengateclassic.org;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/javascript application/json 
               image/svg+xml;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Serve Next.js static files
    location /_next/static {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Handle Next.js client-side routing (CRITICAL!)
    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }

    # Handle 404 errors
    error_page 404 /404.html;
    location = /404.html {
        internal;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

### Step 5: Save and Apply Changes
1. Click **"Save"** or **"Apply"** button
2. CloudPanel will usually:
   - Test the nginx configuration automatically
   - Reload nginx if the test passes
   - Show you any errors if the configuration is invalid

### Step 6: Verify the Configuration

If CloudPanel doesn't automatically test, you can verify via SSH:

```bash
ssh goldengateclassic@54.70.1.215
sudo nginx -t
```

If the test passes, reload nginx:
```bash
sudo systemctl reload nginx
```

### Step 7: Test Your Website

1. Open your browser and visit: `https://www1.goldengateclassic.org/`
2. Test navigating to different pages:
   - `/committee`
   - `/results`
   - `/rules`
   - `/san-francisco`
3. Check browser console (F12) for any errors
4. Test that CSS and images are loading

## Troubleshooting

### If you can't find nginx settings in CloudPanel:

1. **Check CloudPanel version**: Newer versions have different interfaces
2. **Look for "PHP" or "Web Server" settings**: Nginx config might be under these tabs
3. **Check permissions**: You might need admin/root access to modify nginx config
4. **Use File Manager**: Navigate to `/etc/nginx/sites-available/` and edit the file directly

### If CloudPanel shows "Configuration Error":

1. Check that all braces `{ }` are properly closed
2. Ensure there are no syntax errors
3. Make sure the `root` path is correct
4. Verify all semicolons `;` are present at the end of directives

### If changes don't take effect:

1. Make sure you clicked "Save" or "Apply"
2. Wait a few seconds for nginx to reload
3. Clear your browser cache
4. Try hard refresh (Ctrl+F5 or Cmd+Shift+R)
5. Check nginx error logs:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

## Important Notes

⚠️ **The `try_files` directive is CRITICAL!**

Without this line:
```nginx
location / {
    try_files $uri $uri/ $uri.html /index.html;
}
```

Your Next.js routes won't work properly - you'll get 404 errors when visiting pages directly or refreshing.

✅ **Always verify the `root` path matches your deployment directory:**
```nginx
root /home/goldengateclassic/htdocs/www.goldengateclassic.org;
```

## Alternative: SSH Method

If CloudPanel's interface doesn't work for you, you can always configure nginx via SSH:

```bash
# SSH into server
ssh goldengateclassic@54.70.1.215

# Edit nginx config (may need sudo)
sudo nano /etc/nginx/sites-available/www1.goldengateclassic.org

# Or find the config file
sudo find /etc/nginx -name "*goldengateclassic*"

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

See `NGINX_SETUP.md` for complete SSH-based instructions.





