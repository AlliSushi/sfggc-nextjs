---
title: Portal Setup Guide
updated: 2026-02-15
---

# Portal Setup Guide

This guide mirrors the main site setup instructions but focuses on portal-specific local development and deployment.

## Local setup

1. Install [Node.js](https://nodejs.org/en/)
2. From the repo root:
   ```bash
   npm install
   npm run dev
   ```
3. Open:
   - `http://localhost:3000/portal`
   - `http://localhost:3000/portal/admin`
   - `http://localhost:3000/portal/participant`
   - `http://localhost:3000/portal/admin/optional-events` (admin only)
   - `http://localhost:3000/portal/admin/scratch-masters` (admin only)

The participant prototype pages still use CSV data from `portal_docs/sample_data/`. Admin edit flows use the local MariaDB database.

## MariaDB setup (dev)

Install MariaDB:

- macOS: `scripts/dev/install-mariadb-macos.sh`
- Ubuntu: `scripts/dev/install-mariadb-ubuntu.sh`
- Convenience: `scripts/dev/start-mariadb.sh` to start MariaDB if installed
- Frontend: `scripts/dev/start-frontend.sh` to start Next.js

Install dependencies and start MariaDB in one step:

```bash
bash scripts/dev/bootstrap-dev.sh
```

Store your database URL and session secret locally (do not commit secrets). Use a long random
string for `ADMIN_SESSION_SECRET`. Use e.g. `mysql://root@localhost:3306/sfggc_portal_dev` (no password).
On Homebrew MariaDB the init script and app use the Unix socket and your macOS user for localhost,
so this URL works. If your socket path is non-standard, set `MYSQL_UNIX_SOCKET`.

```bash
cp portal_docs/.env.portal.example .env.local
```

Make sure `.env.local` contains plain `KEY=VALUE` lines (no `export`), then restart
the dev server after changes.

Initialize the schema (creates DB if missing). The script loads `PORTAL_DATABASE_URL` from `.env.local`:

```bash
bash scripts/dev/init-portal-db.sh
```

`init-portal-db.sh` applies both:
- the baseline schema in `portal_docs/sql/portal_schema.sql`
- all migrations in `backend/scripts/migrations/` (including optional events columns and portal settings)

For existing workspaces, pull latest code and rerun:

```bash
bash scripts/dev/init-portal-db.sh
```

To run only migrations:

```bash
bash scripts/dev/run-portal-migrations.sh
```

Import IGBO registration XML (ensure `PORTAL_DATABASE_URL` is set, e.g. in `.env.local`):

```bash
bash scripts/dev/import-igbo-xml.sh /tmp/igbo.xml
```

You can import XML from the admin dashboard using the Import XML button.

## Admin bootstrap (create your account)

Use the admin bootstrap script to create your initial admin account:

```bash
export PORTAL_DATABASE_URL="mysql://root@localhost:3306/sfggc_portal_dev"
export ADMIN_EMAIL="you@example.com"
export ADMIN_NAME="Your Name"
export ADMIN_PASSWORD="your-strong-password"
bash backend/scripts/admin/create-super-admin.sh
```

This creates an admin row and a matching participant in the `people` table (so you appear in the participant list).
Use `ADMIN_PID` to override the PID if needed.

If you only want a participant record:

```bash
export PORTAL_DATABASE_URL="mysql://root@localhost:3306/sfggc_portal_dev"
export ADMIN_EMAIL="you@example.com"
bash backend/scripts/admin/create-super-admin.sh --participant-only
```

## Email configuration (participant login)

Participant login uses email magic links sent via SMTP.

### Local development (no SMTP needed)

When `SMTP_HOST` is not set, the login link URL is printed to the Next.js server console. No email account or SMTP credentials are needed for local testing.

### Production

Add these variables to `.env.local`:

```bash
PORTAL_BASE_URL=https://www.goldengateclassic.org
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=Golden Gate Classic <noreply@goldengateclassic.org>
```

`PORTAL_BASE_URL` is used to build the login link URL. It must match the public-facing domain.

## Tests

Run backend tests:
```bash
npm --prefix backend test
```

Test environment notes:
- Tests do not load `.env.local` by default.
- Backend tests do not require MariaDB; the admin bootstrap test uses `SKIP_DB=true`.
- DB-backed tests use `PORTAL_DATABASE_URL` or `PORTAL_TEST_DATABASE_URL` and will skip if no DB is available.
- Test scripts drop the `_test` database after successful runs and keep it on failure for debugging.
- Test scripts auto-load `.env.local` when present.

## Deployment

### Portal UI (same as main site)

Portal UI deploys with the main Next.js site using the same scripts in `deploy_scripts/`.

```bash
npm run build
./deploy_scripts/deploy.sh <ssh_user@server> <domain_path> <domain_name>
```

If you encounter server permission issues, follow the steps in:
- [`SERVER_SETUP.md`](../SERVER_SETUP.md)

### Portal backend

The portal backend runs as part of the Next.js application. See [PORTAL_DEPLOYMENT.md](../deploy_docs/PORTAL_DEPLOYMENT.md) for production deployment steps including database setup, SMTP configuration, and process management.

Production deploy runs migrations automatically (unless `--skip-migrations` is used).

## Troubleshooting

- If portal routes 404, confirm files exist under `src/pages/portal/`.
- If admin pages show no data, confirm the database schema has been initialized and data exists in MariaDB.
- If MariaDB is not running, run `bash scripts/dev/start-mariadb.sh`.
- **Access denied for user 'root'@'localhost' (ERROR 1698)**: Use `mysql://root@localhost:3306/...` in `.env.local`; the init script and app use the socket and your macOS user. If your socket path is non-standard, set `MYSQL_UNIX_SOCKET`.
- If Homebrew services fail (e.g. home on external drive), run `brew services run mariadb` in a separate terminal, or start `mysqld` as shown in the script output.
- Optional Events page shows no data: ensure game scores exist in the `scores` table (import scores via CSV first) and that at least one participant has opt-in flags set (import the optional events CSV).
- Optional Events page not accessible for participants: check the visibility toggle at `/portal/admin/optional-events` -- it defaults to off.
