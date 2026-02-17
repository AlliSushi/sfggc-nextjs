# Nginx Configuration for SFGGC Website

## Source of Truth

The nginx vhost configuration is managed in version control at:

```
backend/config/vhost.txt
```

This file contains the **complete** server block: SSL listeners, portal proxy blocks, static site serving, and caching rules. All nginx changes should be made to this file.

## How to Update Nginx

We do **not** have direct SSH access to nginx. All changes go through CloudPanel:

1. Edit `backend/config/vhost.txt` locally
2. Copy to clipboard: `cat backend/config/vhost.txt | pbcopy`
3. Log into CloudPanel ISP portal
4. Navigate to **Sites** → select domain → **Nginx Settings** / **Vhost**
5. Paste entire contents (replacing everything)
6. Save (CloudPanel validates syntax and reloads nginx automatically)

**Do NOT** attempt `nginx -t`, `systemctl reload nginx`, or direct editing of `/etc/nginx/` files — we don't have those permissions.

## Configuration Overview

The vhost config has four main sections:

### 1. Upstream Block

Persistent connections to the Node.js portal backend (saves 20-50ms per request):

```nginx
upstream portal_backend {
  server 127.0.0.1:3000;
  keepalive 16;
}
```

### 2. Portal Proxy Blocks

Four `location ^~` blocks proxy requests to Node.js. The `^~` modifier is **critical** — without it, the static asset regex (`~* \.(js|css|...)$`) hijacks portal JS requests, breaking React hydration.

```nginx
location ^~ /portal { proxy_pass http://portal_backend; ... }
location ^~ /api/portal { proxy_pass http://portal_backend; ... }
location ^~ /_next/static { alias .../portal-app/.next/static; ... }
location ^~ /_next { proxy_pass http://portal_backend; ... }
```

### 3. Static Site Serving

Serves the pre-built static pages (homepage, results, rules, etc.):

```nginx
location / {
    # Strip trailing slash — /results/ becomes /results, preventing 403
    # on directories that collide with static page names
    rewrite ^/(.+)/$ /$1 permanent;

    # Check .html BEFORE directory to serve results.html instead of results/
    try_files $uri $uri.html $uri/ /index.html;
}
```

**Why this order matters:** The `results/` directory (containing PDFs) shares a name with `results.html` (the Next.js page). If `$uri/` is checked before `$uri.html`, nginx finds the directory and returns 403. The trailing slash rewrite handles cached/typed URLs like `/results/`.

### 4. Static Asset Caching

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Key Configuration Rules

| Rule | Why |
|---|---|
| `^~` on all portal locations | Prevents regex `~* \.(js|css)$` from hijacking portal JS/CSS requests |
| `$uri.html` before `$uri/` in try_files | Prevents 403 when a page name collides with a directory |
| `rewrite ^/(.+)/$ /$1 permanent` | Strips trailing slash so `.html` check can match |
| `proxy_set_header Connection ""` | Required for keepalive (NOT `"upgrade"`) |
| `compress: false` in next.config.js | Nginx handles gzip — avoids double compression |

## Common Issues

### 403 Forbidden
- **Cause 1**: A static page name collides with a directory (e.g., `/results` is both `results.html` and a `results/` folder with PDFs). Nginx tries to list the directory instead of serving the `.html` file.
- **Fix**: Ensure `try_files` checks `$uri.html` before `$uri/`, and the trailing slash rewrite is present. See [Static Site Serving](#3-static-site-serving) above.
- **Cause 2**: Wrong directory permissions or incorrect root path.

### 404 Not Found (but files exist)
- **Cause**: Root path is incorrect or try_files not configured
- **Fix**: Verify the CloudPanel `{{root}}` placeholder resolves to `/home/goldengateclassic/htdocs/www.goldengateclassic.org`

### Portal loads but menus/forms are invisible
- **Cause**: `^~` modifier missing from portal location blocks — the static asset regex is catching `/_next/static/*.js` requests
- **Fix**: Add `^~` to all four portal locations. See [Portal Proxy Blocks](#2-portal-proxy-blocks).

### CSS/JS not loading
- **Cause**: Static files not being served correctly
- **Fix**: Ensure `/_next/static` location block exists with correct `alias` path

## Testing

After updating the config in CloudPanel:

1. **Static site**: `curl -s -o /dev/null -w "%{http_code}" https://www.goldengateclassic.org/`
2. **Results page**: `curl -s -o /dev/null -w "%{http_code}" https://www.goldengateclassic.org/results`
3. **Results PDF**: `curl -s -o /dev/null -w "%{http_code}" https://www.goldengateclassic.org/results/2026/sm_qualifier_final.pdf`
4. **Portal**: `curl -s -o /dev/null -w "%{http_code}" https://www.goldengateclassic.org/portal/`
5. **Portal API**: `curl -s -o /dev/null -w "%{http_code}" https://www.goldengateclassic.org/api/portal/admin/session`

Expected: 200, 200, 200, 308, 401
