# CloudPanel Nginx Configuration for Static Next.js Site

## Issue

Your CloudPanel nginx configuration is currently set up to **proxy** to a Node.js application, but your SFGGC website is a **static Next.js site** that should be served directly from files. You need to replace the proxy configuration with static file serving.

## Solution: Replace the Location Block

In your CloudPanel nginx settings, find the `location /` block and **replace the entire proxy configuration** with this static file serving configuration:

### Replace This (Current - Proxy Configuration):
```nginx
location / {
  proxy_pass http://127.0.0.1:{{app_port}}/;
  proxy_http_version 1.1;
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header X-Forwarded-Server $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Host $host;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "Upgrade";
  proxy_pass_request_headers on;
  proxy_max_temp_file_size 0;
  proxy_connect_timeout 900;
  proxy_send_timeout 900;
  proxy_read_timeout 900;
  proxy_buffer_size 128k;
  proxy_buffers 4 256k;
  proxy_busy_buffers_size 256k;
  proxy_temp_file_write_size 256k;
}
```

### With This (Static File Serving):
```nginx
location / {
  try_files $uri $uri/ $uri.html /index.html;
}

# Serve Next.js static files with long cache
location /_next/static {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

# Cache static assets (images, fonts, CSS, JS)
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

# Handle 404 errors
error_page 404 /404.html;
location = /404.html {
  internal;
}
```

## Complete Updated Configuration

Here's your complete nginx configuration after the change:

```nginx
server {
  listen 80;
  listen [::]:80;
  listen 443 quic;
  listen 443 ssl;
  listen [::]:443 quic;
  listen [::]:443 ssl;
  http2 on;
  http3 off;
  {{ssl_certificate_key}}
  {{ssl_certificate}}
  server_name goldengateclassic.org;
  return 301 https://www.goldengateclassic.org$request_uri;
}

server {
  listen 80;
  listen [::]:80;
  listen 443 quic;
  listen 443 ssl;
  listen [::]:443 quic;
  listen [::]:443 ssl;
  http2 on;
  http3 off;
  {{ssl_certificate_key}}
  {{ssl_certificate}}
  server_name www.goldengateclassic.org www1.goldengateclassic.org;
  {{root}}

  {{nginx_access_log}}
  {{nginx_error_log}}

  if ($scheme != "https") {
    rewrite ^ https://$host$request_uri permanent;
  }

  location ~ /.well-known {
    auth_basic off;
    allow all;
  }

  {{settings}}

  include /etc/nginx/global_settings;

  index index.html;

  # Handle Next.js client-side routing (CRITICAL!)
  location / {
    try_files $uri $uri/ $uri.html /index.html;
  }

  # Serve Next.js static files with long cache
  location /_next/static {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Cache static assets (images, fonts, CSS, JS)
  location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Handle 404 errors
  error_page 404 /404.html;
  location = /404.html {
    internal;
  }
}
```

## Steps to Update in CloudPanel

1. **Open CloudPanel** and navigate to your site: `www.goldengateclassic.org`

2. **Go to Nginx Settings** (or where you edit the nginx config)

3. **Find the `location /` block** - it should have all the `proxy_pass` directives

4. **Replace the entire `location /` block** with:
   ```nginx
   location / {
     try_files $uri $uri/ $uri.html /index.html;
   }
   ```

5. **Add these additional location blocks** right after the `location /` block:
   ```nginx
   # Serve Next.js static files with long cache
   location /_next/static {
     expires 1y;
     add_header Cache-Control "public, immutable";
   }

   # Cache static assets
   location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
     expires 1y;
     add_header Cache-Control "public, immutable";
   }

   # Handle 404 errors
   error_page 404 /404.html;
   location = /404.html {
     internal;
   }
   ```

6. **Save the configuration**

7. **CloudPanel should automatically test and reload nginx**

## Verify the Root Path

Make sure `{{root}}` is set to your deployment directory:
- `/home/goldengateclassic/htdocs/www.goldengateclassic.org`

You can verify this in CloudPanel's site settings - look for "Document Root" or "Root Directory" setting.

## Test After Changes

1. Visit: `https://www1.goldengateclassic.org/`
2. Test pages: `/committee`, `/results`, `/rules`, `/san-francisco`
3. Check browser console (F12) for any errors
4. Verify CSS and images are loading

## Why This Fixes It

- **Before**: nginx was trying to proxy requests to a non-existent Node.js app on port `{{app_port}}`
- **After**: nginx serves static files directly from your deployment directory
- **`try_files`**: Handles Next.js client-side routing by falling back to `index.html` for all routes
- **Static assets**: Properly cached and served from `/_next/static/`

## Troubleshooting

### If you still get errors:
1. Verify the `{{root}}` variable points to: `/home/goldengateclassic/htdocs/www.goldengateclassic.org`
2. Check file permissions on the deployment directory
3. Check nginx error logs:
   ```bash
   ssh goldengateclassic@54.70.1.215
   sudo tail -f /var/log/nginx/error.log
   ```

### If CloudPanel won't save:
- Make sure all braces `{ }` are properly closed
- Ensure all semicolons `;` are present
- Check for any syntax errors in the configuration





