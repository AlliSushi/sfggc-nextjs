# Portal Deployment Guide

This guide covers deploying the SFGGC tournament portal (admin dashboard + participant login) to the production CloudPanel server. The portal runs as a Next.js server application behind nginx, backed by MariaDB on AWS RDS.

## Server Details

| Resource | Value |
|----------|-------|
| Server | `54.70.1.215` (CloudPanel on AWS) |
| SSH user | `goldengateclassic` |
| Static site root | `/home/goldengateclassic/htdocs/www.goldengateclassic.org` |
| Portal app dir | `~/htdocs/www.goldengateclassic.org/portal-app` |
| Database | MariaDB on RDS: `shared2.cdms8mviovca.us-west-2.rds.amazonaws.com:3306/goldengate` |
| SMTP | AWS SES: `email-smtp.us-west-2.amazonaws.com:587` |
| Process manager | PM2 |

## Quick Deploy (Automated Script)

The unified deployment script handles everything: file sync, dependency install, database init, build, and PM2 setup.

```bash
# Run from the project root directory
./deploy_scripts/deploy.sh --portal

# Skip confirmation prompt
./deploy_scripts/deploy.sh --portal --yes

# Force environment reconfiguration (if .env.local is broken)
./deploy_scripts/deploy.sh --portal --setup

# Combine flags
./deploy_scripts/deploy.sh --portal --setup --yes
```

**First-time deploy:** The script detects no `.env.local` on the server and interactively prompts for:
- Database username and password
- Admin session secret (auto-generates a default)
- SMTP password (AWS SES)
- First super-admin account (email, name, password)

**Subsequent deploys:** The script skips environment and admin setup, syncs files, reinstalls dependencies, rebuilds, and restarts PM2.

**Flags:**
- `--yes` or `-y`: Skip the "Do you want to deploy?" confirmation prompt (does not affect credential prompts)
- `--setup`: Force environment reconfiguration, useful for recovering from broken `.env.local` files

**Backwards compatibility:** The old `deploy-portal.sh` script still works but shows a deprecation warning.

After the script finishes, you must configure nginx (see Section 7 below). This is a one-time manual step in CloudPanel.

---

## Manual Deploy (Step-by-Step)

### 1. Environment Variables

Create `.env.local` in the portal app directory on the server:

```bash
# Database (AWS RDS)
PORTAL_DATABASE_URL=mysql://USER:PASSWORD@shared2.cdms8mviovca.us-west-2.rds.amazonaws.com:3306/goldengate

# Session signing
ADMIN_SESSION_SECRET=replace-with-a-long-random-string

# Public URL (used in email links)
PORTAL_BASE_URL=https://www.goldengateclassic.org

# AWS SES SMTP
SMTP_HOST=email-smtp.us-west-2.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIAVU7WKXGTZZA3SOHN
SMTP_PASS=your-ses-smtp-password
SMTP_FROM=Golden Gate Classic <noreply@goldengateclassic.org>
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PORTAL_DATABASE_URL` | Yes | MariaDB connection string (RDS endpoint) |
| `ADMIN_SESSION_SECRET` | Yes | Secret for signing session tokens (use `openssl rand -hex 32`) |
| `PORTAL_BASE_URL` | Yes | Public URL of the site (used in login email links) |
| `SMTP_HOST` | Yes | AWS SES SMTP endpoint |
| `SMTP_PORT` | No | SMTP port (default: 587 for STARTTLS, or 465 for TLS) |
| `SMTP_USER` | Yes | SES SMTP username (IAM access key) |
| `SMTP_PASS` | Yes | SES SMTP password |
| `SMTP_FROM` | No | From address (default: `Golden Gate Classic <noreply@goldengateclassic.org>`) |

### 2. Sync Files to Server

```bash
rsync -az --delete \
  --exclude='node_modules/' --exclude='.git/' --exclude='.next/' \
  --exclude='out/' --exclude='.env*' \
  ./ goldengateclassic@54.70.1.215:~/htdocs/www.goldengateclassic.org/portal-app/
```

### 3. Install Dependencies

```bash
ssh goldengateclassic@54.70.1.215
cd ~/htdocs/www.goldengateclassic.org/portal-app
npm install --production
```

### 4. Database Setup

Initialize the database schema (safe to re-run; uses `CREATE TABLE IF NOT EXISTS`):

```bash
bash scripts/dev/init-portal-db.sh
```

Or load the schema manually:

```bash
mysql -h shared2.cdms8mviovca.us-west-2.rds.amazonaws.com -P 3306 -u USER -p goldengate < portal_docs/sql/portal_schema.sql
```

### 5. Create Super Admin

```bash
export PORTAL_DATABASE_URL="mysql://USER:PASSWORD@shared2.cdms8mviovca.us-west-2.rds.amazonaws.com:3306/goldengate"
export ADMIN_EMAIL="admin@goldengateclassic.org"
export ADMIN_NAME="Admin Name"
export ADMIN_PASSWORD="a-strong-password"
bash backend/scripts/admin/create-super-admin.sh
```

### 6. Build and Start

```bash
npm run build
npm install -g pm2
pm2 start npm --name sfggc-portal -- start
pm2 save
```

Set up PM2 auto-restart on reboot:

```bash
# Add to crontab
PM2_PATH=$(which pm2)
(crontab -l 2>/dev/null; echo "@reboot $PM2_PATH resurrect &> /dev/null") | crontab -
```

### 7. Nginx Configuration (CloudPanel)

The site uses a **hybrid nginx config**: static files for the public site and a reverse proxy for the portal.

#### If You Have Direct Nginx Access

In CloudPanel, add these location blocks to the nginx vhost for `www.goldengateclassic.org`:

```nginx
# Static public site (existing — keep this)
location / {
    try_files $uri $uri/ $uri.html /index.html;
}

# Portal pages — proxy to Next.js server
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

# Next.js assets (needed for portal pages)
location /_next {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

**Important:** The `/portal`, `/api/portal`, and `/_next` blocks must appear **before** the `location /` block so nginx matches them first.

After saving in CloudPanel, test and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### If You Do NOT Have Direct Nginx Access (ISP-Controlled)

If you cannot run `nginx -t` or `systemctl reload nginx` directly, use the copy/paste workflow:

**Configuration File:** `backend/config/vhost.txt`

This file contains the complete nginx vhost configuration, including the portal proxy settings (lines 34-68).

**Workflow:**
1. **Edit locally:** `nano backend/config/vhost.txt`
2. **Copy to clipboard:** `cat backend/config/vhost.txt | pbcopy` (macOS)
3. **Paste in ISP control panel:** Log into web portal → Nginx/Vhost config → Paste → Save
4. **Test:** `curl -I https://www.goldengateclassic.org/portal`
5. **Commit:** `git add backend/config/vhost.txt && git commit -m "Update nginx config"`

The ISP control panel will automatically validate syntax and reload nginx when you save.

For detailed instructions, see: `DEPLOYMENT.md#nginx-configuration-management`

### 8. Import Data

Import IGBO registration XML via the admin dashboard (Import XML button) or from the command line:

```bash
bash scripts/dev/import-igbo-xml.sh /path/to/igbo.xml
```

### 9. Test

1. Admin login: `https://www.goldengateclassic.org/portal/admin/`
2. Participant login: `https://www.goldengateclassic.org/portal/participant/`
3. Enter a registered participant's email and verify the magic link email arrives
4. Click the link and confirm it logs you in

### 10. Deploying Updates

```bash
# From your local machine (project root)
./deploy_scripts/deploy.sh --portal

# Skip confirmation prompt
./deploy_scripts/deploy.sh --portal --yes
```

Or manually:

```bash
# Sync, rebuild, restart
rsync -az --delete --exclude='node_modules/' --exclude='.git/' --exclude='.next/' --exclude='out/' --exclude='.env*' ./ goldengateclassic@54.70.1.215:~/htdocs/www.goldengateclassic.org/portal-app/
ssh goldengateclassic@54.70.1.215 "cd ~/htdocs/www.goldengateclassic.org/portal-app && npm install --production && npm run build && pm2 restart sfggc-portal"
```

---

## Troubleshooting

### Portal returns 502 Bad Gateway
The Next.js process isn't running. Check:
```bash
pm2 status
pm2 logs sfggc-portal --lines 50
```

### Login email not arriving
1. Verify SMTP vars in `.env.local` (especially `SMTP_PASS`)
2. Check server firewall allows outbound on port 587: `nc -zv email-smtp.us-west-2.amazonaws.com 587`
3. Check if the sender address is verified in AWS SES (required in sandbox mode)
4. Check PM2 logs for SMTP errors: `pm2 logs sfggc-portal --lines 50`

### AWS SES Sandbox Mode
New SES accounts start in sandbox mode, which only allows sending to verified email addresses. To send to any address, request production access in the AWS SES console.

### Database connection errors
1. Verify `PORTAL_DATABASE_URL` in `.env.local`
2. Test connectivity: `mysql -h shared2.cdms8mviovca.us-west-2.rds.amazonaws.com -P 3306 -u USER -p goldengate -e "SELECT 1;"`
3. Check that the RDS security group allows inbound from the CloudPanel server's IP

### Session issues after deploy
Sessions are signed with `ADMIN_SESSION_SECRET`. If this value changes, all existing sessions are invalidated and users must log in again. This is expected and not harmful.

### Static site pages return 404 after adding portal
Make sure the `location /` block with `try_files` is still present in the nginx config. The portal proxy blocks should be added alongside it, not replace it.

### Broken .env.local with empty passwords
If your portal won't start and you see empty passwords in `.env.local` on the server, use the `--setup` flag to force reconfiguration:

```bash
./deploy_scripts/deploy.sh --portal --setup
```

This can happen if an older version of the deployment script was used with the `--force` flag during first-time setup. The script will now properly prompt for all credentials and create a fresh `.env.local` file.

See the [UNIFIED_DEPLOYMENT.md](UNIFIED_DEPLOYMENT.md#broken-envlocal-with-empty-passwords) guide for more details.
