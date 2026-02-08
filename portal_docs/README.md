---
title: SFGGC Portal
updated: 2026-01-29
---

# SFGGC Tournament Portal

This is the portal for the SFGGC tournament, covering admin and participant experiences under `/portal`. It lives in the same repository as the public website, with portal pages under `src/pages/portal/` and a backend service under `backend/`.

## Development & local running

1. Clone this repository
2. Install [Node.js](https://nodejs.org/en/)
3. Run `npm install`
4. Start the Next.js dev server:
   ```bash
   npm run dev
   ```

Portal routes:
- `http://localhost:3000/portal`
- `http://localhost:3000/portal/admin`
- `http://localhost:3000/portal/participant`

The participant prototype pages still use CSV data from `portal_docs/sample_data/`. Admin edit flows use the local MariaDB database.

## MariaDB setup (local)

Install MariaDB:

- macOS: `scripts/dev/install-mariadb-macos.sh`
- Ubuntu: `scripts/dev/install-mariadb-ubuntu.sh`
- Convenience: `scripts/dev/start-mariadb.sh` to start MariaDB if installed
- Frontend: `scripts/dev/start-frontend.sh` to start Next.js

Install dependencies and start MariaDB in one step:

```bash
bash scripts/dev/bootstrap-dev.sh
```

Set the database URL in a local env file:

```bash
cp portal_docs/.env.portal.example .env.local
```

Then edit `.env.local` with your `PORTAL_DATABASE_URL` and `ADMIN_SESSION_SECRET`
(do not commit secrets). `ADMIN_SESSION_SECRET` should be a long random string.
Use e.g. `mysql://root@localhost:3306/sfggc_portal_dev` (no password). On Homebrew MariaDB
the init script and app use the Unix socket and your macOS user when connecting to
localhost, so this URL works even though the DB `root` user is socket-only. If your
socket is in a non-standard place, set `MYSQL_UNIX_SOCKET` to its path.
Make sure `.env.local` contains plain `KEY=VALUE` lines (no `export`), then restart
the dev server after changes.

Initialize the portal schema (creates DB if missing). The script loads `PORTAL_DATABASE_URL`
from `.env.local` automatically:

```bash
bash scripts/dev/init-portal-db.sh
```

Import IGBO registration XML (ensure `PORTAL_DATABASE_URL` is set in the environment or in `.env.local`):

```bash
bash scripts/dev/import-igbo-xml.sh /tmp/igbo.xml
```

You can import XML from the admin dashboard using the Import XML button.

If the admin dashboard shows no data, run the XML import or create a participant
via the admin bootstrap script.

## Backend (local)

The backend API routes use MariaDB for participant details and audit logs.

Run backend tests:
```bash
npm --prefix backend test
```

Test environment notes:
- Tests do not load `.env.local` by default.
- Backend tests do not require MariaDB; the admin bootstrap test uses `SKIP_DB=true`.

## Admin bootstrap

Create your admin account in the local database:

```bash
export PORTAL_DATABASE_URL="mysql://root@localhost:3306/sfggc_portal_dev"
export ADMIN_EMAIL="you@example.com"
export ADMIN_NAME="Your Name"
export ADMIN_PASSWORD="your-strong-password"
bash backend/scripts/admin/create-super-admin.sh
```

This creates an admin row and a matching participant in the `people` table (so you appear in the participant list). PID defaults to `DEVADMIN`; use `ADMIN_PID` to override.

If you only want a participant record (no admin):

```bash
export PORTAL_DATABASE_URL="mysql://root@localhost:3306/sfggc_portal_dev"
export ADMIN_EMAIL="you@example.com"
bash backend/scripts/admin/create-super-admin.sh --participant-only
```

## Participant login

Participants log in via email magic links. The participant enters their email on `/portal/participant`, receives a single-use login link (30-minute expiry), and clicking it creates a 48-hour session.

**Local development (no SMTP):** When `SMTP_HOST` is not set, the login link URL is printed to the Next.js server console. Copy and paste it into your browser to test the flow.

**Production:** Set the SMTP environment variables in `.env.local` (see `.env.portal.example` for the full list). The email is sent via `nodemailer` and works with any SMTP server.

## Tests (BDD-style)

Run all tests:
```bash
./scripts/test/test-all.sh
```

Run frontend tests:
```bash
./scripts/test/test-frontend.sh
```

Run backend tests:
```bash
./scripts/test/test-backend.sh
```

DB-backed tests:
- Set `PORTAL_DATABASE_URL` or `PORTAL_TEST_DATABASE_URL` (recommended).
- MariaDB must be running; tests auto-create `<db>_test` if needed.
- If no DB URL is available, DB-backed tests will skip.
- Test scripts drop the `_test` database after successful runs and keep it on failure for debugging.
- Test scripts auto-load `.env.local` when present.

## Deployment

The portal UI and backend deploy together as a Next.js application. See [PORTAL_DEPLOYMENT.md](../deploy_docs/PORTAL_DEPLOYMENT.md) for server setup, environment variables, and production deployment steps.

See:
- [portal_layout.md](portal_layout.md)
- [portal_architecture.md](portal_architecture.md)
- [portal_database_architecture.md](portal_database_architecture.md)

## Troubleshooting

- MariaDB not running: `bash scripts/dev/start-mariadb.sh`
- Connection refused: confirm `PORTAL_DATABASE_URL` and that the DB exists
- **Access denied for user 'root'@'localhost' (ERROR 1698)**: The init script and app use the Unix socket and your macOS user for localhost; keep `mysql://root@localhost:3306/...` in `.env.local`. If your socket is elsewhere, set `MYSQL_UNIX_SOCKET` (e.g. `export MYSQL_UNIX_SOCKET=/tmp/mysql.sock`).
- Blank admin dashboard: run the XML import or create a participant record
- If Homebrew services fail (e.g. home on external drive), start MariaDB in a separate terminal: `brew services run mariadb`, or run `mysqld` directly as shown in the script output.
