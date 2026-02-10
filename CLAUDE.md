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
- `/portal/admin/` - Admin dashboard, participant search, audit logs
- `/portal/participant/` - Participant login (magic link) and profile view
- `/portal/team/[teamSlug]` - Team roster and doubles pairings

**API Routes:**
- Authentication: `POST /api/portal/admin/login`, `POST /api/portal/participant/login`, `GET /api/portal/participant/verify`
- Data: `GET /api/portal/participants`, `GET /api/portal/participants/[pid]`, `PATCH /api/portal/participants/[pid]`
- Admin management: `GET/PATCH /api/portal/admins/[id]`, `POST /api/portal/admins/[id]/force-password-change`
- Admin: `POST /api/portal/admin/import-xml`, `GET /api/portal/admin/audit`

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
- `doubles_pairs` - Doubles partnerships (did, pid, partner_pid)
- `scores` - Game scores (pid + event_type: team/doubles/singles, 3 games each, book average, auto-calculated handicap)
- `admins` - Admin users (UUID, email, password_hash, role, optional PID link)
- `audit_logs` - Change tracking (admin, participant, field, old_value, new_value)
- `participant_login_tokens` - Single-use magic link tokens (30-min expiry)
- `admin_password_resets` - Single-use password reset tokens

**Key Patterns:**
- **Import-first:** IGBO XML imports populate database via `importIgboXml.js`
- **Upsert:** Import scripts update existing records or insert new ones (idempotent)
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
- `src/utils/portal/importIgboXml.js` - XML import parser (handles BOOK_AVERAGE attributes, extracts #text property)
- `src/utils/portal/participant-db.js` - Participant data access, handicap auto-calculation in upsertScores()
- `src/pages/api/portal/participants/[pid].js` - Participant CRUD API
- `src/pages/api/portal/admin/login.js` - Admin authentication
- `src/pages/api/portal/admin/import-xml.js` - XML import endpoint

**Database Migrations:**
- `backend/scripts/migrations/add-scores-unique-constraint.sh` - Adds unique index on scores(pid, event_type)
- All migrations run automatically during portal deployment
- See `deploy_docs/MIGRATIONS.md` for migration system details

**Documentation:**
- `CLAUDE-PATTERNS.md` - Reusable code patterns (session management, password security, API routes, migrations, testing)
- `CLAUDE-DEPLOYMENT.md` - Deployment patterns, credential handling, CI/CD, critical gotchas
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
6. Handicap auto-calculated from book average: `floor((225 - bookAverage) * 0.9)`
7. Unique constraint `scores(pid, event_type)` ensures idempotent updates
8. Links existing admins to imported participants by email/phone
9. Returns import summary

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

### Testing Patterns

BDD workflow methodology is defined in the user-level `~/.claude/CLAUDE.md`. This section covers project-specific testing details.

**Test Runner:** `node:test` with `node:assert/strict`. No external test frameworks.

**Test Naming:** BDD Given/When/Then convention:
```
"Given <context>, when <action>, then <expected outcome>"
```

**Test Types:**
- **Static source analysis** -- read file contents, assert structural properties (imports, exports, naming, guard clauses). See `tests/unit/no-server-imports-frontend.test.js`, `tests/unit/refactoring-dry.test.js`.
- **Behavioral tests** -- exercise functions/modules with inputs, assert outputs. See `backend/tests/api/audit.test.js`.
- **Route existence tests** -- verify expected files exist on disk. See `tests/frontend/portal-routes.test.js`.

**See `CLAUDE-PATTERNS.md#BDD Test Patterns` for test implementation patterns.**

**Test Locations:**

| Directory | Purpose |
|---|---|
| `tests/unit/` | Unit tests (source analysis + behavioral) |
| `tests/frontend/` | Frontend route and structure tests |
| `tests/helpers/` | Shared test utilities (`test-db.js`, `api-server.js`) |
| `backend/tests/api/` | Backend API integration tests |
| `backend/tests/fixtures/` | Test data (XML fixtures) |

**Commands:**
```bash
bash scripts/test/test-all.sh      # Run all tests
bash scripts/test/test-frontend.sh # Frontend tests only
bash scripts/test/test-backend.sh  # Backend/API tests only
```

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
