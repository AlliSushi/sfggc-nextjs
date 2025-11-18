# Nginx Configuration for SFGGC Website

## Issue

If you're getting an nginx error after deployment, it's likely because nginx needs proper configuration to serve the Next.js static site. Unlike Apache (which uses `.htaccess`), nginx requires a configuration file in its sites directory.

## Quick Fix

### Option 1: CloudPanel Configuration (Recommended)

If you're using CloudPanel:

1. **Log into CloudPanel**
2. **Navigate to Sites** → Select your domain
3. **Go to Nginx Settings** or **Web Server Settings**
4. **Add custom nginx configuration** in the custom directives section:

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

# Handle Next.js pages with try_files for client-side routing
location / {
    try_files $uri $uri/ $uri.html /index.html;
}

# Handle 404 errors
error_page 404 /404.html;
location = /404.html {
    internal;
}
```

5. **Save the configuration**
6. **Reload nginx** (CloudPanel usually does this automatically)

### Option 2: Manual Nginx Configuration

If you need to configure nginx manually via SSH:

1. **SSH into your server:**
   ```bash
   ssh goldengateclassic@54.70.1.215
   ```

2. **Create nginx configuration file:**
   ```bash
   sudo nano /etc/nginx/sites-available/www1.goldengateclassic.org
   ```

3. **Copy the configuration from `nginx.conf.example`** in the `deploy_docs/` directory

4. **Adjust the `root` path** if your deployment path is different:
   ```nginx
   root /home/goldengateclassic/htdocs/www.goldengateclassic.org;
   ```

5. **Enable the site:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/www1.goldengateclassic.org /etc/nginx/sites-enabled/
   ```

6. **Test nginx configuration:**
   ```bash
   sudo nginx -t
   ```

7. **Reload nginx:**
   ```bash
   sudo systemctl reload nginx
   # OR
   sudo service nginx reload
   ```

## Key Configuration Points

### 1. Root Directory
Make sure the `root` directive points to your actual deployment directory:
```nginx
root /home/goldengateclassic/htdocs/www.goldengateclassic.org;
```

### 2. Try Files for Routing
Next.js uses client-side routing, so we need to handle all routes:
```nginx
location / {
    try_files $uri $uri/ $uri.html /index.html;
}
```

This tells nginx to:
- First try the exact file (`$uri`)
- Then try as a directory (`$uri/`)
- Then try with `.html` extension (`$uri.html`)
- Finally, fall back to `index.html` for client-side routing

### 3. Static Assets
Next.js static files are in `/_next/static/` and should be cached:
```nginx
location /_next/static {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 4. 404 Handling
Next.js exports a custom 404 page:
```nginx
error_page 404 /404.html;
location = /404.html {
    internal;
}
```

## Common Issues

### 403 Forbidden
- **Cause**: Wrong directory permissions or incorrect root path
- **Fix**: 
  ```bash
  sudo chown -R goldengateclassic:goldengateclassic /home/goldengateclassic/htdocs/www.goldengateclassic.org
  sudo chmod -R 755 /home/goldengateclassic/htdocs/www.goldengateclassic.org
  ```

### 404 Not Found (but files exist)
- **Cause**: Root path is incorrect or try_files not configured
- **Fix**: Verify the `root` directive matches your deployment path

### CSS/JS not loading
- **Cause**: Static files not being served correctly
- **Fix**: Ensure `/_next/static` location block is configured correctly

### Routes not working (page refreshes show 404)
- **Cause**: Missing `try_files` directive
- **Fix**: Add the `try_files` directive as shown above

## Testing

After configuration, test your site:

1. **Homepage**: `https://www1.goldengateclassic.org/`
2. **Pages**: `https://www1.goldengateclassic.org/committee`
3. **404**: Visit a non-existent page to test error handling
4. **Static assets**: Check browser dev tools to ensure CSS/JS load

## SSL/HTTPS

If you haven't set up SSL yet, CloudPanel can usually do this automatically. Look for:
- **SSL/TLS** settings in CloudPanel
- **Let's Encrypt** certificate option
- Auto-renewal should be enabled

Once SSL is configured, update your nginx config to include the SSL listener lines (see `nginx.conf.example` in this directory).





