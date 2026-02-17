# CLAUDE-PATTERNS.md

Reusable code patterns for this Next.js portal application. See CLAUDE.md for project overview.

## Session Management Patterns

### Timestamp-Based Session Revocation

**Problem:** Invalidate all active sessions without maintaining a blacklist.

**Solution:** Compare session creation time (`iat`) against revocation timestamp in database.

**Pattern:**

1. Add `sessions_revoked_at TIMESTAMP NULL` column to user table
2. Include `iat` (issued at) timestamp in session token payload
3. Auth guards query revocation timestamp on every authenticated request
4. Session invalid if `iat < sessions_revoked_at`

**Implementation:**

```javascript
// Session creation (src/utils/portal/session.js)
const payload = {
  email: admin.email,
  role: admin.role,
  iat: Date.now(), // Issued-at timestamp in milliseconds
};

// Auth guard check (src/utils/portal/auth-guards.js)
const checkSessionRevocation = async (adminSession) => {
  const { rows } = await query(
    "SELECT sessions_revoked_at FROM admins WHERE email = ? LIMIT 1",
    [adminSession.email]
  );

  const sessionsRevokedAt = rows[0]?.sessions_revoked_at;
  if (!sessionsRevokedAt) return true; // No revocation

  const sessionCreatedAt = adminSession.iat;
  const revocationTime = new Date(sessionsRevokedAt).getTime();

  return sessionCreatedAt >= revocationTime; // Valid if created after revocation
};
```

**Performance:** Adds one database query per authenticated request. Acceptable tradeoff for admin security features (low traffic, high security value). Document when using this pattern.

**Files:**
- Session token creation: `src/utils/portal/session.js`
- Auth guard implementation: `src/utils/portal/auth-guards.js`
- Database schema: `portal_docs/sql/portal_schema.sql`
- Migration: `backend/scripts/migrations/add-sessions-revoked-at.sh`

## Auth Guard Await Pattern

**CRITICAL ANTI-PATTERN:** Calling async auth guards without `await`.

All three auth guard functions are `async` and return `null` on auth failure:
- `requireSuperAdmin(req, res)`
- `requireAdmin(req, res)`
- `requireParticipantMatchOrAdmin(req, res, pid)`

**Without `await`, the return value is a Promise (always truthy), which:**
1. Bypasses authentication entirely -- `if (!payload) return` never triggers
2. Makes `payload.email` undefined -- causes `"Column 'admin_email' cannot be null"` database errors

**Wrong:**
```javascript
const payload = requireSuperAdmin(req, res);  // Returns Promise (truthy!)
if (!payload) return;                          // Never triggers
await query("... ?", [payload.email]);         // payload.email is undefined
```

**Correct:**
```javascript
const payload = await requireSuperAdmin(req, res);
if (!payload) return;
```

**Enforcement:** `tests/unit/auth-guard-await.test.js` -- static analysis test that scans all API route files for non-awaited auth guard calls.

**Files:**
- Auth guards: `src/utils/portal/auth-guards.js`
- Test: `tests/unit/auth-guard-await.test.js`

## mysql2 Return Value Destructuring

**CRITICAL ANTI-PATTERN:** Using object destructuring on `mysql2/promise` query results.

The `mysql2/promise` `pool.query()` returns an **array** `[rows, fields]`, not an object `{ rows }`.

**Wrong (object destructuring -- rows is undefined):**
```javascript
const { rows } = await pool.query("SELECT * FROM people");
// rows is undefined -- object destructuring on an array
```

**Correct (array destructuring):**
```javascript
const [rows] = await pool.query("SELECT * FROM people");
```

**Note:** The project's `query()` wrapper in `src/utils/portal/db.js` returns `{ rows }`, so this only applies to **direct `pool.query()` calls** -- typically in integration tests that access `db.pool` directly.

**Files:**
- DB wrapper: `src/utils/portal/db.js` (returns `{ rows }`)
- Integration tests: `tests/integration/*.test.js` (use `pool.query()` directly)

## Password Security Patterns

### Secure Password Generation

**Rule:** Use `crypto.randomInt()`, never `Math.random()`.

**Pattern:**

```javascript
const crypto = require("crypto");

function generateStrongPassword(length = 16) {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  // Ensure at least one of each type
  const password = [
    uppercase[crypto.randomInt(uppercase.length)],
    lowercase[crypto.randomInt(lowercase.length)],
    numbers[crypto.randomInt(numbers.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];

  // Fill remaining with random selection
  const allChars = uppercase + lowercase + numbers + symbols;
  for (let i = 4; i < length; i++) {
    password.push(allChars[crypto.randomInt(allChars.length)]);
  }

  // Fisher-Yates shuffle with crypto randomness
  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
}
```

**File:** `src/utils/portal/password-generator.js`

### Password Change Validation

**Pattern:** Verify new password differs from current before setting.

```javascript
// Before setting new password
const isSamePassword = await bcrypt.compare(newPassword, currentPasswordHash);
if (isSamePassword) {
  throw new Error("New password must differ from current password");
}

const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
```

### Force Password Change Workflow

**Steps:**

1. Generate secure temporary password
2. Hash with bcrypt
3. Update user record in transaction:
   - Set new password hash
   - Set `must_change_password = true` flag
   - Set `sessions_revoked_at = NOW()` to invalidate existing sessions
4. Log admin action to audit table
5. Email temporary password to user
6. Login endpoint checks `must_change_password` flag, redirects to password change page

**Files:**
- Force password API: `src/pages/api/portal/admins/[id]/force-password-change.js`
- Login check: `src/pages/api/portal/admin/login.js`
- Password change page: `src/pages/portal/admin/reset-password.js`

## Next.js API Route Patterns

### Sub-Route Organization

**Problem:** Support `/api/foo/:id` and `/api/foo/:id/action` routes simultaneously.

**Solution:** Move `[id].js` to `[id]/index.js`, add sibling action files.

**Before:**
```
src/pages/api/foo/
  ├── index.js       (handles /api/foo)
  └── [id].js        (handles /api/foo/:id)
```

**After:**
```
src/pages/api/foo/
  ├── index.js           (handles /api/foo)
  └── [id]/
      ├── index.js       (handles /api/foo/:id)
      ├── action.js      (handles /api/foo/:id/action)
      └── other.js       (handles /api/foo/:id/other)
```

**Impact:** Tests checking file paths need updating. Plan route structure early to minimize test churn.

**Example:**
- `src/pages/api/portal/admins/[id]/index.js` - GET/PATCH admin by ID
- `src/pages/api/portal/admins/[id]/force-password-change.js` - POST force password change

## Database Migration Patterns

**See `deploy_docs/MIGRATIONS.md` for complete migration system.**

### Idempotent Column Addition

**Pattern:** Check `information_schema` before adding column.

```bash
# Query to check if column exists
EXISTS=$(mysql ... -N -s "$db_name" <<SQL
SELECT COUNT(*) FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = '$db_name'
  AND TABLE_NAME = 'table_name'
  AND COLUMN_NAME = 'column_name';
SQL
)

if [[ "$EXISTS" -gt 0 ]]; then
  echo "✓ Column already exists"
  exit 0
fi

# Add column
mysql ... "$db_name" <<SQL
ALTER TABLE table_name ADD COLUMN column_name TIMESTAMP NULL;
SQL
```

**Alternative:** Use prepared statements for conditional DDL.

```sql
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'admins'
  AND COLUMN_NAME = 'sessions_revoked_at';

SET @query = IF(@col_exists = 0,
  'ALTER TABLE admins ADD COLUMN sessions_revoked_at TIMESTAMP NULL',
  'SELECT "Column already exists" AS message');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

**Example:** `backend/scripts/migrations/add-sessions-revoked-at.sh`

### Unix Socket Detection

**Pattern:** Auto-detect localhost Unix socket, fallback to TCP.

```bash
db_host=$(extract from PORTAL_DATABASE_URL)

if [[ "$db_host" == "localhost" ]] || [[ "$db_host" == "127.0.0.1" ]]; then
  # Try Unix socket first (faster, avoids auth issues on macOS Homebrew)
  for sock in /tmp/mysql.sock /opt/homebrew/var/mysql/mysql.sock; do
    if [[ -S "$sock" ]]; then
      MYSQL_ARGS+=(--socket="$sock" --user="${USER}")
      break
    fi
  done
else
  # Remote connection - use credentials
  MYSQL_ARGS+=(--host="$db_host" --user="$db_user" --password="$db_pass")
fi
```

**Files:** All migration scripts in `backend/scripts/migrations/`

## Email Template Patterns

### Database-Stored Templates with Variables

**Pattern:** Store templates in database, substitute variables at send time.

**Table:** `email_templates`
- `slug` - unique identifier (e.g., `forced-password-reset`)
- `subject` - email subject with `{{variables}}`
- `body_text` - plain text body with `{{variables}}`
- `body_html` - HTML body override (optional)

**Usage:**

```javascript
const template = await getEmailTemplate("forced-password-reset");

const variables = {
  firstName: "John",
  temporaryPassword: "aB3$xY9!zM2#",
  portalUrl: "https://example.com/portal",
};

const { subject, body } = await renderEmailTemplate(template, variables);
await sendEmail({ to, subject, body });
```

**Variable substitution:** Simple string replacement `{{variableName}}` or template library.

**Files:**
- Template utilities: `src/utils/portal/email-templates-db.js`
- Send utilities: `src/utils/portal/send-login-email.js`

## BDD Test Patterns

### Static Source Analysis Tests

**Pattern:** Read file contents, assert structural properties (no execution).

**Use cases:**
- Verify imports/exports
- Check naming conventions
- Validate guard clauses
- Confirm pattern adherence (DRY, security)

**Example:**

```javascript
test("Given password generator, when checking implementation, then it uses crypto.randomInt not Math.random", () => {
  const content = fs.readFileSync("src/utils/portal/password-generator.js", "utf8");

  assert.ok(
    content.includes("crypto.randomInt"),
    "must use crypto.randomInt for secure randomness"
  );

  assert.ok(
    !content.includes("Math.random"),
    "must not use Math.random (insecure)"
  );
});
```

**Files:** `tests/unit/no-server-imports-frontend.test.js`, `tests/unit/admin-force-password-change.test.js`

### Route Existence Tests

**Pattern:** Verify expected API route files exist on disk.

**Impact:** Update when restructuring routes (e.g., `[id].js` → `[id]/index.js`).

**Example:**

```javascript
test("Given admins API routes, when checking structure, then force-password-change endpoint exists", () => {
  const routePath = path.join(
    projectRoot,
    "src/pages/api/portal/admins/[id]/force-password-change.js"
  );

  assert.ok(
    fs.existsSync(routePath),
    "force-password-change endpoint must exist"
  );
});
```

**Files:** `tests/frontend/portal-routes.test.js`

### Migration Tests

**Pattern:** Test migration script existence, executability, and idempotency.

**Template:**

```javascript
const MIGRATION_SCRIPT = path.join(
  process.cwd(),
  "backend/scripts/migrations/add-column.sh"
);

test("Given migration script, when checking file, then it exists and is executable", () => {
  assert.ok(fs.existsSync(MIGRATION_SCRIPT));
  const stats = fs.statSync(MIGRATION_SCRIPT);
  assert.ok(stats.mode & fs.constants.S_IXUSR);
});

test("Given migration script, when checking logic, then it's idempotent", () => {
  const content = fs.readFileSync(MIGRATION_SCRIPT, "utf-8");
  const hasCheck = content.includes("information_schema") ||
                   content.includes("IF NOT EXISTS");
  assert.ok(hasCheck, "Migration must check if change already exists");
});
```

**Files:** `tests/unit/migrations/` directory

### Dev Environment for Database-Dependent Tests

**Rule:** When working on portal features that touch the database (API routes, imports, participant data, scores, audit logs), ensure MariaDB is running before running backend tests.

**Start MariaDB:**
```bash
bash scripts/dev/start-mariadb.sh
```

**Verify it's running:**
```bash
pgrep -qf mysqld && echo "MariaDB running" || echo "MariaDB NOT running"
```

**Test scripts that require a running database:**
- `bash scripts/test/test-backend.sh` — backend API integration tests
- `bash scripts/test/test-all.sh` — full suite (includes backend tests)

**Test scripts that do NOT require a database:**
- `bash scripts/test/test-frontend.sh` — frontend structural/route tests
- Individual unit tests with mock queries (`node --test tests/unit/*.test.js`)

**Key:** The test scripts do NOT start MariaDB themselves. The agent must ensure it's running before invoking `test-backend.sh` or `test-all.sh`.

### Integration Test Admin Seeding

**Problem:** Auth guards call `checkSessionRevocation()` which queries the `admins` table. Integration tests that use `buildAdminCookie()` / `buildSessionToken()` fail with 401 if no matching admin row exists in the database.

**Root cause:** `checkSessionRevocation` returns `false` (triggering 401) when `rows[0]` is undefined -- i.e., when no admin row with a matching email exists.

**Solution:** Seed an admin row in test setup before making authenticated requests:

```javascript
const seedDefaultAdmin = async (role = "super-admin") => {
  await db.pool.query(
    "INSERT IGNORE INTO admins (id, email, name, role, password_hash) VALUES (?,?,?,?,?)",
    [crypto.randomUUID(), "admin@example.com", "Admin", role, "not-a-real-hash"]
  );
};
```

**Key:** The email in the seed must match the email used in `buildSessionToken()` / `buildAdminCookie()`.

**Files:** `tests/integration/portal-api.test.js`, `tests/integration/lane-assignments-api.test.js`

### Connection Pool Cleanup in Integration Tests

**Problem:** Node.js process hangs after integration tests because the `db.js` connection pool keeps the event loop alive.

**Solution:** Export `closePool()` from `db.js` and call it in the `after()` hook:

```javascript
const db = require("../../src/utils/portal/db.js");

after(async () => {
  await db.closePool();
});
```

**Files:**
- Pool export: `src/utils/portal/db.js`
- Integration tests: `tests/integration/*.test.js`

## Audit Logging Patterns

### Admin Action Logging

**Pattern:** Log all admin actions with UUID, email, action type, and JSON details.

**Table:** `admin_actions`
- `id` - UUID (crypto.randomUUID())
- `admin_email` - Who performed action
- `action` - Action type slug (e.g., `force_password_change`)
- `details` - JSON object with action-specific data
- `created_at` - Timestamp

**Usage:**

```javascript
const actionId = crypto.randomUUID();
await query(
  "INSERT INTO admin_actions (id, admin_email, action, details) VALUES (?, ?, ?, ?)",
  [
    actionId,
    adminEmail,
    "force_password_change",
    JSON.stringify({
      targetAdminId: "...",
      targetAdminEmail: "...",
    }),
  ]
);
```

**Files:** `src/utils/portal/audit.js`, API routes in `src/pages/api/portal/admin/`

## SQL Performance Patterns

### N+1 Correlated Subqueries -> LEFT JOINs

**Problem:** Correlated subqueries execute once per row, causing O(n) query overhead.

**Anti-pattern (6 subqueries per row):**
```sql
SELECT p.*,
  (SELECT team_name FROM teams WHERE tnmt_id = p.tnmt_id) AS team_name,
  (SELECT slug FROM teams WHERE tnmt_id = p.tnmt_id) AS team_slug,
  (SELECT CONCAT(first_name, ' ', last_name) FROM people WHERE pid = dp.partner_pid) AS partner_name
FROM people p
LEFT JOIN doubles_pairs dp ON p.did = dp.did;
```

**Correct (single pass with LEFT JOINs):**
```sql
SELECT p.*,
  t.team_name, t.slug AS team_slug,
  CONCAT(partner.first_name, ' ', partner.last_name) AS partner_name
FROM people p
LEFT JOIN teams t ON p.tnmt_id = t.tnmt_id
LEFT JOIN doubles_pairs dp ON p.did = dp.did
LEFT JOIN people partner ON dp.partner_pid = partner.pid;
```

**CRITICAL:** Always JOIN `doubles_pairs` on `p.did = dp.did` (the participant's current doubles ID), never on `p.pid = dp.pid`. Joining on `pid` returns stale rows from previous pairings, causing `LIMIT 1` to pick the wrong partner.

**Rule:** Never use correlated subqueries in SELECT clause for list endpoints. Always use LEFT JOIN.

**File:** `src/utils/portal/participant-db.js` -- `getParticipants()` uses LEFT JOINs.

### COALESCE Guard for Import Upserts

**Problem:** Bulk imports (XML, CSV) send null for fields they don't populate (e.g., XML has no lane data). A plain `col = VALUES(col)` overwrites existing data with null.

**SQL-level solution:** Use `COALESCE(VALUES(col), col)` — use the new value if non-null, otherwise keep the existing value.

```sql
ON DUPLICATE KEY UPDATE
  lane = COALESCE(VALUES(lane), lane),       -- preserve if import is null
  entering_avg = VALUES(entering_avg)         -- always overwrite (import has value)
```

**Application-level solution:** Filter out null-to-existing changes before generating SQL. Use `wouldClobberExisting(newValue, oldValue)` predicate.

**When to use:** Import paths where the source data is incomplete by design.

**When NOT to use:** Admin edit forms that always send full state (the null is intentional). See `participant-db.js` `upsertScores`.

**Files:**
- `importIgboXml.js` — SQL COALESCE on `lane`, `game1`, `game2`, `game3`
- `importLanesCsv.js` — `wouldClobberExisting()` predicate in `computeLaneChanges`
- `importScoresCsv.js` — Both: app-level `wouldClobberExisting()` filter + SQL `COALESCE(VALUES(game1), game1)` on `game1`, `game2`, `game3`

### Stale Row Cleanup Before Upsert

**Problem:** When a participant changes doubles partner, the old `doubles_pairs` row remains. Queries joining on `pid` return multiple rows; `LIMIT 1` picks the oldest (wrong) partner. Stale rows also cause false positives in the Possible Issues dashboard (partner-target-multiple-owners, participant-with-multiple-partners, non-reciprocal-doubles-partners).

**Pattern:** DELETE stale rows before upserting the current pairing.

```javascript
// In upsertDoublesPair (src/utils/portal/participant-db.js)
await query(
  "DELETE FROM doubles_pairs WHERE pid = ? AND did <> ?",
  [pid, doubles.did]
);
// Then upsert the current pairing
await query(
  "INSERT INTO doubles_pairs (did, pid, partner_pid) VALUES (?,?,?) ON DUPLICATE KEY UPDATE ...",
  [doubles.did, pid, doubles.partnerPid]
);
```

**Rule:** When a table can accumulate orphaned rows from previous states (partner changes, team reassignments), delete stale entries before upserting. The DELETE predicate must keep the current record (`did <> ?`) and remove only rows for the same participant (`pid = ?`).

**Files:**
- Implementation: `src/utils/portal/participant-db.js` -- `upsertDoublesPair()`
- Test: `tests/unit/doubles-pair-update.test.js`

### Name-Based CSV Matching with Team Disambiguation

**Problem:** Score CSV files identify bowlers by display name (no PID). Multiple bowlers may share the same name across different teams.

**Pattern:** Build a lowercase name index from `CONCAT(first_name, ' ', last_name)`. Single match resolves immediately. Multiple matches disambiguate using CSV team name vs DB team name (prefix comparison handles scoring software truncation).

```javascript
// Build lookup: lowercase full name → list of DB people
const nameIndex = new Map();
for (const person of dbPeople) {
  const fullName = `${person.first_name} ${person.last_name}`.toLowerCase().trim();
  const list = nameIndex.get(fullName) || [];
  list.push(person);
  nameIndex.set(fullName, list);
}

// Match: single hit → use it; multiple hits → filter by team name
if (candidates.length === 1) {
  person = candidates[0];
} else {
  const teamMatches = candidates.filter(c =>
    teamNamesMatch(bowler.csvTeamName, c.team_name)
  );
  if (teamMatches.length === 1) person = teamMatches[0];
  else { unmatched.push(...); continue; }
}
```

**Team name comparison:** `startsWith` in both directions to handle scoring software truncating long team names.

**Files:** `src/utils/portal/importScoresCsv.js` -- `matchParticipants()`, `teamNamesMatch()`
**Test:** `tests/unit/import-scores-csv.test.js`

### CSV Pivot: Multiple Rows Per Entity to Single Record

**Problem:** Bowling scoring software exports one row per game per bowler (3 rows per person). The database stores one record per person per event type with `game1`, `game2`, `game3` columns.

**Pattern:** Group rows by lowercase bowler name, assign scores by game number.

```javascript
const pivotRowsByBowler = (rows) => {
  const bowlers = new Map();
  for (const row of rows) {
    const key = row["Bowler name"].trim().toLowerCase();
    if (!bowlers.has(key)) {
      bowlers.set(key, { name: row["Bowler name"].trim(), game1: null, game2: null, game3: null });
    }
    const gameNum = parseInt(row["Game number"], 10);
    const score = normalizeScoreValue(row["Scratch"]);
    if (gameNum === 1) bowlers.get(key).game1 = score;
    else if (gameNum === 2) bowlers.get(key).game2 = score;
    else if (gameNum === 3) bowlers.get(key).game3 = score;
  }
  return bowlers;
};
```

**Rule:** Import only touches `game1`, `game2`, `game3` -- never `lane`, `entering_avg`, or `handicap`. Those are managed by lane import and XML import respectively.

**Files:** `src/utils/portal/importScoresCsv.js` -- `pivotRowsByBowler()`
**Test:** `tests/unit/import-scores-csv.test.js`

### Score Aggregation Extraction

**Problem:** Team/doubles score totals were computed inline in the team API endpoint. The logic was buggy (picked one member instead of summing all) and non-reusable.

**Pattern:** Extract aggregation into pure utility functions. Team scores sum all members per game; doubles scores sum both partners per game.

```javascript
// Team: sum all members' per-game scores
const sumGame = (field) => {
  const values = members.map(m => m[field]).filter(v => v != null);
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
};
return filterNonNull([sumGame("team_game1"), sumGame("team_game2"), sumGame("team_game3")]);

// Doubles: sum both partners' per-game scores
const v1 = member1?.[field];
const v2 = member2?.[field];
return (v1 || 0) + (v2 || 0);
```

**Files:** `src/utils/portal/team-scores.js` -- `extractTeamScores()`, `extractTeamLane()`, `extractDoublesPairScores()`
**Consumer:** `src/pages/api/portal/teams/[teamSlug].js`
**Test:** `tests/unit/team-score-aggregation.test.js`

### Sequential SSR Fetch Consolidation

**Problem:** `getServerSideProps` making multiple sequential API calls (each adds network latency).

**Pattern:** When a page needs data from multiple endpoints, add secondary data to the primary endpoint response rather than making N sequential fetches from SSR.

**Anti-pattern:**
```javascript
export async function getServerSideProps(context) {
  const participants = await fetch('/api/portal/participants');
  const teams = await fetch('/api/portal/teams');         // +100ms
  const scores = await fetch('/api/portal/scores');       // +100ms
  // ...
}
```

**Correct:** Include related data in the primary query via JOINs, or add query parameters to expand the response.

## Nginx Performance Patterns

### Upstream Keepalive

See `CLAUDE-DEPLOYMENT.md#Nginx Upstream Keepalive` for configuration.

**Key rule:** Use `Connection ""` (empty string) for keepalive, NOT `Connection "upgrade"`. The upgrade header forces per-request connection upgrade, defeating persistent connections.

### Compress: false in next.config.js

When nginx handles gzip (via `gzip on` in server config), disable Next.js compression to avoid double-compression:

```javascript
// next.config.js
const nextConfig = {
  compress: false,  // nginx handles gzip -- do not re-enable
};
```

**Current state:** Already configured. See `CLAUDE-DEPLOYMENT.md#Nginx Gzip and next.config.js`.

## Visibility Toggle Route Pattern

**Problem:** Multiple API routes need identical GET (public) / PUT (admin-only) toggle behavior for boolean settings.

**Solution:** Factory function `createVisibilityToggleHandler` produces a handler from a config object.

```javascript
import { createVisibilityToggleHandler } from "../utils/portal/visibility-toggle-route.js";

export default createVisibilityToggleHandler({
  valueKey: "participantsCanViewScores",       // JSON key in request/response
  getVisibility: getScoresVisibleToParticipants, // async () => boolean
  setVisibility: setScoresVisibleToParticipants, // async (boolean) => void
  action: "set_scores_visibility",              // audit log action slug
});
```

**Behavior:**
- `GET` -- public, no auth required. Returns `{ [valueKey]: boolean }`. Used by static pages via client-side fetch.
- `PUT` -- admin-only (`requireAdmin`). Expects `{ [valueKey]: boolean }` in body. Logs to audit.

**Files:**
- Factory: `src/utils/portal/visibility-toggle-route.js`
- Consumers: `src/pages/api/portal/admin/scores/visibility.js`, `src/pages/api/portal/admin/optional-events/visibility.js`

## Client-Side Visibility Fetching on Static Pages

**Problem:** Static export pages (`output: 'export'`) cannot use `getServerSideProps`. Dynamic content visibility must be determined at runtime.

**Pattern:** Use `useEffect` + `fetch` to query public visibility endpoints, then conditionally render UI elements.

```javascript
const [showStandingsLink, setShowStandingsLink] = useState(false);

useEffect(() => {
  fetch("/api/portal/admin/scores/visibility")
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.participantsCanViewScores) setShowStandingsLink(true);
    })
    .catch(() => {});  // Silently fail -- links stay hidden
}, []);
```

**Key rules:**
- Default state is `false` (hidden) -- links only appear after successful API response
- `.catch(() => {})` prevents unhandled rejection when API is unreachable
- Visibility endpoints must allow unauthenticated GET (see Visibility Toggle Route Pattern above)

**Files:**
- Page: `src/pages/results.js`
- Component: `src/components/Results/Results.js` (receives `showStandingsLink`, `showOptionalEventsLink` as props)
- Test: `tests/frontend/results-page-public-links.test.js`

## Component Data Array Pattern

**Problem:** Components with repeated card/item blocks contain duplicated JSX.

**Pattern:** Define data as an array of objects, render with `.map()`.

```javascript
const winners = [
  { image: divisionAImage, name: 'TJ Pettit', division: 'A' },
  { image: divisionBImage, name: 'Gary McNamara', division: 'B' },
];

// In JSX:
{winners.map(({ image, name, division }) => (
  <div key={division}>
    <Image src={image} alt={name} />
    <p>{name}</p>
    <p>Division {division}</p>
  </div>
))}
```

**Rule:** When a component renders 3+ structurally identical items, extract data into an array and use `.map()`.

**Example:** `src/components/ScrMstWinners/ScrMstWinners.js`

## Performance Tradeoff Documentation

**Pattern:** Document deliberate performance tradeoffs in comments and CLAUDE.md.

**Example:** Session revocation check (force password change feature)

```javascript
/**
 * Checks if admin session has been revoked via sessions_revoked_at timestamp.
 *
 * PERFORMANCE: Adds one database query per authenticated admin request.
 * TRADEOFF: Acceptable for admin security features (low traffic, high security value).
 *
 * Alternative (rejected): Session blacklist requires cache maintenance and memory overhead.
 * Current approach: Timestamp comparison with database query.
 */
const checkSessionRevocation = async (adminSession) => {
  // Query sessions_revoked_at timestamp...
};
```

**Rule:** Document why the tradeoff is acceptable, what alternatives were considered.
