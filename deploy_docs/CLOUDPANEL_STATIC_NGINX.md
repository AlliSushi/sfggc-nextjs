# CloudPanel Nginx Configuration: Static Site + Portal

## Overview

The SFGGC site uses a **hybrid nginx config**: static files for the public site and a reverse proxy to a Next.js server (port 3000) for the tournament portal. This replaces the old proxy-only configuration.

## What to Configure

Replace the CloudPanel default `location /` proxy block with the blocks below. The portal proxy blocks **must** appear before the `location /` catch-all.

```nginx
# Portal pages — proxy to Next.js server on port 3000
location /portal {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_cache_bypass $http_upgrade;
}

# Portal API routes
location /api/portal {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

# Next.js assets (JS/CSS bundles for portal pages)
location /_next {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  expires 1y;
  add_header Cache-Control "public, immutable";
}

# Static public site — catch-all for non-portal routes
location / {
  try_files $uri $uri/ $uri.html /index.html;
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

  # Portal pages — proxy to Next.js server on port 3000
  location /portal {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }

  # Portal API routes
  location /api/portal {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Next.js assets (JS/CSS bundles for portal pages)
  location /_next {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Static public site — catch-all
  location / {
    try_files $uri $uri/ $uri.html /index.html;
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
2. **Go to Nginx Settings** (Vhost tab)
3. **Replace** the existing location blocks with the full config from the "What to Configure" section above
4. **Save** — CloudPanel will test and reload nginx automatically
5. **Verify** by visiting both the public site and the portal

## Verify the Root Path

Make sure `{{root}}` is set to your deployment directory:
- `/home/goldengateclassic/htdocs/www.goldengateclassic.org`

You can verify this in CloudPanel's site settings - look for "Document Root" or "Root Directory" setting.

## Test After Changes

1. Static site: `https://www.goldengateclassic.org/` (public pages: `/committee`, `/results`, `/rules`)
2. Portal: `https://www.goldengateclassic.org/portal/`
3. Portal admin: `https://www.goldengateclassic.org/portal/admin/`
4. Check browser console (F12) for errors

## How It Works

- `/portal/*` and `/api/portal/*` are proxied to the Next.js server on port 3000
- `/_next/*` is proxied so portal pages can load their JS/CSS bundles
- Everything else is served as static files from the document root
- The `location /` catch-all with `try_files` handles client-side routing for the public site

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





