# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 14 static website for the San Francisco Golden Gate Classic, an IGBO-affiliated bowling tournament. The project combines a public-facing marketing site with an authenticated tournament management portal backed by MariaDB.

**Key Technologies:**
- Next.js 14 with React 18 (static site generation)
- Bootstrap 5 with custom SCSS modules
- MariaDB/MySQL database
- Custom authentication (cookie-based sessions)

## Development Commands

### Setup and Running

```bash
# Initial setup
npm install

# Run development server
npm run dev

# Build static site for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Portal Development Setup

```bash
# Bootstrap entire development environment
bash scripts/dev/bootstrap-dev.sh

# Initialize portal database schema
bash scripts/dev/init-portal-db.sh

# Import tournament registration XML (optional)
bash scripts/dev/import-igbo-xml.sh /path/to/igbo.xml

# Start frontend only
bash scripts/dev/start-frontend.sh

# Start MariaDB (if installed)
bash scripts/dev/start-mariadb.sh
```

### Testing

```bash
# Run all tests
bash scripts/test/test-all.sh

# Run frontend tests only
bash scripts/test/test-frontend.sh

# Run backend/API tests only
bash scripts/test/test-backend.sh
```

### Database Management

```bash
# Install MariaDB (choose your OS)
bash scripts/dev/install-mariadb-macos.sh
bash scripts/dev/install-mariadb-ubuntu.sh

# Create super admin user
bash backend/scripts/admin/create-super-admin.sh
```

### Deployment

**CRITICAL:** All deployment scripts must be run from the project root directory (not from within `deploy_scripts/`) because they use relative paths to the `out` directory.

#### Unified Deployment System

The project uses a unified deployment script that supports static site, portal application, or both:

```bash
# Deploy static site (default)
./deploy_scripts/deploy.sh

# Deploy portal application
./deploy_scripts/deploy.sh --portal

# Deploy everything (static + portal)
./deploy_scripts/deploy.sh --all

# Preview deployment with dry-run
./deploy_scripts/deploy.sh --portal --dry-run

# Dry-run with verbose output
./deploy_scripts/deploy.sh --all --dry-run --verbose
```

**Configuration:**
- Production defaults are already configured in `.deployrc.example` (used automatically)
- Only create custom `.deployrc` if deploying to staging/test environments
- All secrets (passwords) are prompted interactively during deployment, never stored locally

**First-time portal deployment:**
- Use `--portal` flag for interactive setup
- Script will prompt for:
  - Database password (username pre-configured as "goldengate") → stored in server's `.env.local`
  - SMTP password (username pre-configured) → stored in server's `.env.local`
  - Super admin account (email, name, password) → stored in database
  - Session secret → auto-generated, stored in server's `.env.local`
- Database schema will be initialized automatically
- All secrets remain on the server only

**Subsequent deployments:** Skip prompts (configuration already exists on server), just sync code and restart.

**Critical deployment patterns:** See `CLAUDE-DEPLOYMENT.md` for credential handling, flag behavior, CI/CD patterns, and common gotchas.

See `deploy_docs/UNIFIED_DEPLOYMENT.md` for complete deployment guide and `SERVER_SETUP.md` for server configuration and troubleshooting.

## Architecture

### Dual-Purpose Application

This is a monorepo combining two distinct applications in one Next.js project:

1. **Public Website** (`src/pages/index.js`, `results.js`, `rules.js`, etc.)
   - Static marketing pages
   - Tournament information and rules
   - No authentication required
   - Results page fetches visibility flags client-side (cannot use SSR in static export). See `CLAUDE-PATTERNS.md#Client-Side Visibility Fetching on Static Pages`

2. **Portal System** (`src/pages/portal/`, `src/pages/api/portal/`)
   - Authenticated tournament management
   - Database-backed dynamic content
   - Role-based access control (admins and participants)
   - Audit logging for compliance

### Backend Architecture

There is **no separate backend server**. The "backend" is implemented via:

- **Next.js API Routes** in `src/pages/api/portal/` - handles all API requests
- **Utility modules** in `src/utils/portal/` - database, sessions, auth guards
- **Backend directory** (`backend/`) - contains test fixtures, sample data, and admin CLI scripts (NOT a separate server)

### Portal System Components

**Frontend Pages:**
- `/portal/` - Role chooser (admin or participant)
- `/portal/admin/` - Admin dashboard, participant search, audit logs, lane assignments
- `/portal/participant/` - Participant login (magic link) and profile view
- `/portal/team/[teamSlug]` - Team roster and doubles pairings

**API Routes:**
- Authentication: `POST /api/portal/admin/login`, `POST /api/portal/participant/login`, `GET /api/portal/participant/verify`
- Data: `GET /api/portal/participants`, `GET /api/portal/participants/[pid]`, `PATCH /api/portal/participants/[pid]`
- Admin management: `GET/PATCH /api/portal/admins/[id]`, `POST /api/portal/admins/[id]/force-password-change`
- Admin: `POST /api/portal/admin/import-xml`, `POST /api/portal/admin/import-lanes`, `POST /api/portal/admin/import-scores`, `GET /api/portal/admin/lane-assignments`, `GET /api/portal/admin/possible-issues`, `GET /api/portal/admin/audit`
- Visibility: `GET/PUT /api/portal/admin/scores/visibility`, `GET/PUT /api/portal/admin/optional-events/visibility` (GET is public/unauthenticated for static page consumption)
- Scores: `GET /api/portal/scores`, `GET /api/portal/admin/optional-events`

**Note:** Sub-routes use `[id]/index.js` pattern. See `CLAUDE-PATTERNS.md#Next.js API Route Patterns`

**Authentication:**
- **Admins:** Email/password with bcrypt, 6-hour sessions, roles: `super-admin` or `tournament-admin`
- **Session revocation:** Timestamp-based invalidation (`sessions_revoked_at` vs `iat`), no blacklist needed. See `CLAUDE-PATTERNS.md#Session Management Patterns`
- **Participants:** Magic links (30-min expiry) creating 48-hour sessions, passwordless
- **Sessions:** Custom HMAC-SHA256 signed tokens (not JWT), stored in HttpOnly cookies with `iat` timestamp

### Database Architecture

**Technology:** MariaDB/MySQL with connection pooling (`mysql2/promise`)

**Core Tables:**
- `people` - Participant records (PID from IGBO, demographics, team/doubles references)
- `teams` - Tournament teams (tnmt_id, team_name, slug)
- `doubles_pairs` - Doubles partnerships (did, pid, partner_pid). JOIN on `p.did = dp.did`, never on `pid`. Stale rows cleaned by `upsertDoublesPair`
- `scores` - Game scores (pid + event_type: team/doubles/singles, 3 games each, book average, auto-calculated handicap)
- `admins` - Admin users (UUID, email, password_hash, role, optional PID link)
- `audit_logs` - Change tracking (admin, participant, field, old_value, new_value)
- `participant_login_tokens` - Single-use magic link tokens (30-min expiry)
- `admin_password_resets` - Single-use password reset tokens

**Key Patterns:**
- **Import-first:** IGBO XML imports populate database via `importIgboXml.js`
- **Upsert:** Import scripts update existing records or insert new ones (idempotent)
- **Null-preservation:** Re-imports preserve existing values when the import source lacks data for a field. XML uses `COALESCE(VALUES(col), col)` for `lane`/`game1-3`; lane CSV uses `wouldClobberExisting()` predicate; score CSV uses both (app-level filter + SQL COALESCE)
- **Unique constraints:** `scores(pid, event_type)` ensures one record per participant per event, enables ON DUPLICATE KEY UPDATE
- **Auto-calculation:** Handicap = floor((225 - bookAverage) * 0.9), calculated automatically, never manually editable
- **Audit logging:** All admin edits tracked with before/after values
- **Transactions:** Multi-step operations (imports, updates with audit) use database transactions
- **Connection:** Auto-detects Unix socket (macOS Homebrew) or TCP, configured via `PORTAL_DATABASE_URL`

**Schema Location:** `portal_docs/sql/portal_schema.sql`

**Critical Database Patterns:**

| Pattern | Rule | Example |
|---|---|---|
| **ON DUPLICATE KEY UPDATE** | Requires unique constraint on conflict fields | `scores(pid, event_type)` needs unique index for per-participant updates |
| **Calculated fields** | Never store manually editable calculated values | Handicap = `Math.floor((225 - avg) * 0.9)` calculated in `upsertScores`, not UI |
| **XML attribute parsing** | fast-xml-parser stores attributes as `{'#text': value, '@_attr': attrValue}` | `person.BOOK_AVERAGE?.['#text'] ?? person.BOOK_AVERAGE` |
| **Database migrations** | Must be idempotent, check existence before applying | Query `information_schema` before ALTER, clean duplicates before adding constraints |
| **No correlated subqueries** | Use LEFT JOIN for list endpoints, never SELECT subqueries | See `CLAUDE-PATTERNS.md#N+1 Correlated Subqueries -> LEFT JOINs` |
| **Import null-preservation** | Import upserts must never clobber existing data with nulls | SQL: `COALESCE(VALUES(col), col)`; App: `wouldClobberExisting()`. Used in XML, lane CSV, and score CSV imports. See `CLAUDE-PATTERNS.md#COALESCE Guard for Import Upserts` |
| **doubles_pairs JOIN** | Always join on `p.did = dp.did`, never `p.pid = dp.pid` | Joining on `pid` returns stale rows from previous pairings. See `CLAUDE-PATTERNS.md#N+1 Correlated Subqueries -> LEFT JOINs` |
| **Stale row cleanup** | DELETE orphaned rows before upserting when entities change ownership | `upsertDoublesPair` deletes stale `doubles_pairs` rows before INSERT. See `CLAUDE-PATTERNS.md#Stale Row Cleanup Before Upsert` |

**Migration Requirements:**
- Executable script in `backend/scripts/migrations/`
- Idempotent checks (exits early if already applied)
- Unix socket detection for localhost, TCP fallback
- BDD test in `tests/unit/migrations/` verifying existence, executability, idempotency
- See `deploy_docs/MIGRATIONS.md` for templates, `CLAUDE-PATTERNS.md#Database Migration Patterns` for implementation patterns

### Component Conventions

All components follow this pattern:

```javascript
import styles from './ComponentName.module.scss';

const ComponentName = () => {
  return (
    <section className={`${styles.ComponentName}`}>
      {/* Component content */}
    </section>
  )
}

export default ComponentName;
```

**Naming:**
- Components: PascalCase (`Hero`, `RegisterCTA`)
- Files: Match component name (`Hero.js`, `Hero.module.scss`)
- CSS classes: PascalCase in SCSS modules (`.Hero`, `.Content`)
- Directories: Match component name (`Hero/`, `RegisterCTA/`)

**Layout Pattern:**

Pages use custom layout via `getLayout`:

```javascript
PageComponent.getLayout = function getLayout(page) {
  return (
    <RootLayout>
      {page}
    </RootLayout>
  );
}
```

### Styling Architecture

**SCSS Structure:**
- `src/scss/sfggc-bootstrap.scss` - Custom Bootstrap variables and overrides
- `src/scss/sfggc.scss` - Main stylesheet with global styles
- Component-specific `.module.scss` files for scoped styles

**Mobile-First Design:**
The project uses mobile-first responsive design (2/3 of visitors are on mobile). Always start with mobile viewport styles, then use Bootstrap breakpoints (576px, 768px, 992px, 1200px) to adapt for larger screens.

**CSS Custom Properties:**
Use CSS custom properties for theming:
- `var(--sfggc-title-font-family)` for headings
- `var(--sfggc-section-heading-color)` for section headings
- `var(--sfggc-body-text-shadow-color)` for text shadows

**Section Pattern:**
Most components are sections with:
- Section wrapper with component-specific class
- `.section-heading` for titles
- `.section-image-background` for background images (z-index: -50)
- `.section-background-shade` for overlays (z-index: -49)
- Responsive margins and padding

### Key Files Reference

**Core Architecture:**
- `src/pages/_app.js` - App wrapper with Bootstrap and Analytics
- `src/components/layout/layout.js` - Root layout with theme provider
- `src/utils/ThemeContext.js` - Bootstrap color mode management (dark/light/auto)
- `src/scss/sfggc.scss` - Main stylesheet

**Portal Implementation:**
- `src/utils/portal/db.js` - Database connection pool
- `src/utils/portal/session.js` - Authentication and session tokens
- `src/utils/portal/auth-guards.js` - Request authentication middleware
- `src/utils/portal/audit.js` - Audit log writing
- `src/utils/portal/importIgboXml.js` - XML import parser (handles BOOK_AVERAGE attributes, extracts #text property, COALESCE null-preservation)
- `src/utils/portal/participant-db.js` - Participant data access, handicap auto-calculation in upsertScores(), stale doubles_pairs cleanup in upsertDoublesPair()
- `src/pages/api/portal/participants/[pid].js` - Participant CRUD API
- `src/pages/api/portal/admin/login.js` - Admin authentication
- `src/pages/api/portal/admin/import-xml.js` - XML import endpoint
- `src/pages/api/portal/admin/import-lanes.js` - CSV lane import endpoint (preview + import)
- `src/pages/api/portal/admin/lane-assignments.js` - Lane assignments display endpoint
- `src/utils/portal/importLanesCsv.js` - CSV lane import business logic with `wouldClobberExisting` null-preservation guard
- `src/pages/api/portal/admin/import-scores.js` - CSV score import endpoint (preview + import)
- `src/utils/portal/importScoresCsv.js` - CSV score import business logic (name-based matching, CSV pivot, COALESCE null-preservation, cross-reference warnings)
- `src/utils/portal/team-scores.js` - Team/doubles score aggregation utilities (extracted from team API)
- `src/utils/portal/lane-assignments.js` - Lane assignment display builder (odd-lane pairing)
- `src/utils/portal/csv.js` - CSV parser
- `src/utils/portal/event-constants.js` - EVENT_TYPES constants (team, doubles, singles)
- `src/pages/api/portal/admin/possible-issues.js` - Data quality monitor endpoint
- `src/utils/portal/possible-issues.js` - Data quality issue detection (5 categories: missing team/lane/partner, duplicate partners, non-reciprocal doubles, multiple partners, lanes without teams)
- `src/utils/portal/visibility-toggle-route.js` - Shared factory for visibility toggle API routes (`createVisibilityToggleHandler`). See `CLAUDE-PATTERNS.md#Visibility Toggle Route Pattern`
- `src/utils/portal/optional-events.js` - Optional events standings builder (best 3 of 9, all events handicapped, optional scratch by division)
- `src/pages/api/portal/admin/scores/visibility.js` - Scores visibility toggle (public GET, admin PUT)
- `src/pages/api/portal/admin/optional-events/visibility.js` - Optional events visibility toggle (public GET, admin PUT)

**Database Migrations:**
- `backend/scripts/migrations/add-scores-unique-constraint.sh` - Adds unique index on scores(pid, event_type)
- All migrations run automatically during portal deployment
- See `deploy_docs/MIGRATIONS.md` for migration system details

**Deploy Pipeline:**
- `deploy_scripts/lib/optimize-images.sh` - Pre-build image resizing (macOS `sips`, `MAX_IMAGE_WIDTH=800`). Required because `images: { unoptimized: true }` is set for static export. See `CLAUDE-DEPLOYMENT.md#Image Optimization in Deploy Pipeline`
- `deploy_scripts/lib/build.sh` - Build orchestration; `write_server_mode_config()` prevents template drift. See `CLAUDE-DEPLOYMENT.md#Server-Mode Config Template`

**Server Configuration:**
- `backend/config/vhost.txt` - Nginx vhost config (deployed via CloudPanel ISP portal, NOT direct SSH). See `CLAUDE-DEPLOYMENT.md#Nginx Configuration Workflow`
- `next.config.js` - `compress: false` (nginx handles gzip). See `CLAUDE-PATTERNS.md#Compress: false in next.config.js`

**Documentation:**
- `CLAUDE-PATTERNS.md` - Reusable code patterns (session management, password security, API routes, migrations, SQL performance, nginx)
- `CLAUDE-DEPLOYMENT.md` - Deployment patterns, credential handling, nginx `^~` rules, SSH inline scripts, CI/CD, critical gotchas
- `portal_docs/portal_architecture.md` - Complete portal architecture
- `portal_docs/portal_database_architecture.md` - Database design details
- `deploy_docs/DEPLOYMENT.md` - Deployment guide
- `deploy_docs/UNIFIED_DEPLOYMENT.md` - Technical deployment documentation
- `deploy_docs/MIGRATIONS.md` - Database migration system
- `SERVER_SETUP.md` - Server configuration and troubleshooting

## Development Notes

### Component Organization

Each component lives in its own directory:
```
src/components/Hero/
  ├── Hero.js
  └── Hero.module.scss
```

Combine Bootstrap utility classes with custom SCSS modules for styling.

### Database Connection

The database connection automatically handles:
- Unix socket detection for localhost (macOS Homebrew: `/tmp/mysql.sock`)
- Fallback to TCP connection for remote databases
- Connection pooling for performance
- Environment-driven configuration via `PORTAL_DATABASE_URL`

### XML Import Flow

1. Admin uploads IGBO registration XML via admin dashboard
2. `POST /api/portal/admin/import-xml` receives multipart form data
3. Parser (`importIgboXml.js`) extracts people, teams, doubles pairs, scores, book averages
4. Parser handles XML attributes: `person.BOOK_AVERAGE?.['#text'] ?? person.BOOK_AVERAGE`
5. Transaction-wrapped upsert to database (preserves IGBO IDs)
6. COALESCE guards prevent nulls from overwriting existing data (e.g., lane assignments). See `CLAUDE-PATTERNS.md#COALESCE Guard for Import Upserts`
7. Handicap auto-calculated from book average: `floor((225 - bookAverage) * 0.9)`
8. Unique constraint `scores(pid, event_type)` ensures idempotent updates
9. Links existing admins to imported participants by email/phone
10. Returns import summary

### Lane Import Flow

1. Admin uploads CSV via admin dashboard
2. `POST /api/portal/admin/import-lanes` receives CSV (supports preview and import modes)
3. Parser (`importLanesCsv.js`) extracts lane assignments per participant and event
4. `wouldClobberExisting()` predicate filters out changes that would overwrite existing non-null values with nulls. See `CLAUDE-PATTERNS.md#COALESCE Guard for Import Upserts`
5. Transaction-wrapped upsert to database
6. Returns import summary with change counts and skipped clobber warnings

### Score Import Flow

1. Admin selects event type (team/doubles/singles) and uploads CSV via admin dashboard
2. `POST /api/portal/admin/import-scores` receives CSV text (supports preview and import modes)
3. Parser (`importScoresCsv.js`) validates required columns: Bowler name, Scratch, Game number, Team name, Lane number
4. `pivotRowsByBowler()` converts per-game CSV rows into per-bowler records (game1/game2/game3)
5. `matchParticipants()` matches by `CONCAT(first_name, ' ', last_name)` with team name disambiguation for duplicates
6. Preview returns matched/unmatched/warnings (cross-reference: team/lane mismatches)
7. Import only touches `game1`, `game2`, `game3` columns -- never `lane`, `entering_avg`, or `handicap`
8. SQL: `COALESCE(VALUES(game1), game1)` null-preservation. See `CLAUDE-PATTERNS.md#COALESCE Guard for Import Upserts`
9. Audit fields: `score_{eventType}_game1`, `score_{eventType}_game2`, `score_{eventType}_game3`
10. Transaction-wrapped with `logAdminAction` for `import_scores` action

### Authentication Flow

**Participant Login:**
1. Enter email/phone → `POST /api/portal/participant/login`
2. Backend creates single-use token (30-min expiry), sends magic link
3. Click link → `GET /api/portal/participant/verify?token=...`
4. Backend validates token, creates 48-hour session cookie
5. Redirect to participant profile

**Admin Login:**
1. Enter email/password → `POST /api/portal/admin/login`
2. Backend validates bcrypt hash, creates 6-hour session cookie
3. Redirect to admin dashboard

### Bootstrap and Theme Management

The project uses Bootstrap 5 with custom color mode support (dark/light/auto). Theme state is managed via `ThemeContext` and persisted to localStorage. The theme switcher is in the navigation component.

### Image Organization

Images are organized by category in `src/images/`:
- Use responsive images with multiple sizes
- Store background images for sections here
- Apply `.section-background-shade` overlays for text readability
- Source images wider than 800px are auto-resized during deploy build (`deploy_scripts/lib/optimize-images.sh`). Next.js image optimization is disabled (`unoptimized: true`) for static export, so source images must be pre-optimized.

### Testing Patterns

BDD workflow methodology is defined in the user-level `~/.claude/CLAUDE.md`. This section covers project-specific testing details.

**Test Runner:** `node:test` with `node:assert/strict`. No external test frameworks.

**Test Naming:** BDD Given/When/Then convention:
```
"Given <context>, when <action>, then <expected outcome>"
```

**Test Types:**
- **Static source analysis** -- read file contents, assert structural properties (imports, exports, naming, guard clauses). See `tests/unit/no-server-imports-frontend.test.js`, `tests/unit/refactoring-dry.test.js`.
- **Behavioral tests** -- exercise functions/modules with inputs, assert outputs. See `backend/tests/api/audit.test.js`, `tests/unit/import-xml-no-clobber.test.js`, `tests/unit/import-lanes-csv.test.js`, `tests/unit/import-scores-csv.test.js`, `tests/unit/team-score-aggregation.test.js`, `tests/unit/doubles-pair-update.test.js`, `tests/unit/optimize-images.test.js`.
- **Route existence tests** -- verify expected files exist on disk. See `tests/frontend/portal-routes.test.js`.
- **Page behavior tests** -- verify page source fetches correct APIs and passes correct props. See `tests/frontend/results-page-public-links.test.js`.

**See `CLAUDE-PATTERNS.md#BDD Test Patterns` for test implementation patterns.**

**Test Locations:**

| Directory | Purpose |
|---|---|
| `tests/unit/` | Unit tests (source analysis + behavioral) |
| `tests/frontend/` | Frontend route and structure tests |
| `tests/integration/` | Integration tests (DB-dependent, auto-skip without DB) |
| `tests/helpers/` | Shared test utilities (`test-db.js`, `api-server.js`) |
| `backend/tests/api/` | Backend API integration tests |
| `backend/tests/fixtures/` | Test data (XML fixtures) |

**Commands:**
```bash
bash scripts/test/test-all.sh      # Run all tests (unit + integration + backend)
bash scripts/test/test-frontend.sh # Frontend tests only (unit + route tests)
bash scripts/test/test-backend.sh  # Backend/API tests only
```

**Note:** `test-all.sh` runs integration tests (`tests/integration/*.test.js`) as a separate step between frontend and backend tests.

**Database prerequisite:** Backend and full-suite tests require MariaDB to be running. Start it with `bash scripts/dev/start-mariadb.sh` before running `test-backend.sh` or `test-all.sh`. The test scripts do not start the database themselves.

**Database Tests:** Automatically create/drop `<database>_test` databases. On failure, the test database is preserved for debugging.

**Rule:** During development, run only the localized tests for files being changed. Run `bash scripts/test/test-all.sh` after all sprints are complete or before checking in code.

### Security Considerations

- All database queries use parameterized statements (SQL injection prevention)
- Admin passwords hashed with bcrypt, strong password generation uses `crypto.randomInt()` (see `CLAUDE-PATTERNS.md#Password Security Patterns`)
- Session tokens in HttpOnly cookies (XSS prevention)
- HMAC signatures on session tokens (tampering prevention)
- Session revocation via timestamp comparison (force password change, security breach scenarios)
- Audit logging for admin actions
- No user enumeration on participant login (always shows "check your email")
- Role-based access control enforced at API route level
- **Auth guards MUST be awaited** -- `requireSuperAdmin`, `requireAdmin`, `requireParticipantMatchOrAdmin` are async; missing `await` bypasses auth entirely (see `CLAUDE-PATTERNS.md#Auth Guard Await Pattern`)
