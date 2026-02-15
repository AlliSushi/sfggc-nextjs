---
title: Portal Database Architecture
updated: 2026-02-15
---

## Summary

Use MariaDB as the source of truth. Keep schema normalized for participants, teams, doubles pairs, events, scores, and audits. Preserve imported IDs (PID, TnmtID, DID) for traceability.

## Core Entities

- **people**: PID, name, email/phone, demographics, status, division
- **admins**: auth user id, role, status
- **admin_roles**: role name and permissions (optional if using enum)
- **teams**: TnmtID, team name
- **doubles_pairs**: DID, partner IDs, partner name fields
- **events**: event type, tournament reference
- **scores**: per-event per-game scores
- **tournaments**: tournament metadata
- **audit_logs**: admin actions and changes
- **portal_settings**: key-value configuration (visibility toggles)

## Relationships (high level)

- people → teams (many people to one team)
- people → doubles_pairs (two people per doubles pair)
- people → scores (one person to many score rows)
- admins → people (optional link for admins who are also participants)
- tournaments → events (one tournament to many events)
- events → scores (one event to many scores)
- audit_logs → admins (one admin to many audit records)

## ID Strategy

- Keep `PID`, `TnmtID`, and `DID` from imports as stable primary or unique keys.
- Add internal surrogate keys only if necessary for performance or ORM constraints.

## CSV Seed Strategy

- Load teams first, then people, then doubles pairs, then events/scores.
- Validate foreign keys during seed to catch inconsistent sample data.

## Test Database Lifecycle

- Test runs use a separate `<db>_test` database.
- Test scripts drop the test database on success and keep it on failure.

## Security and Access

- Use row-level security for participant access (read only their own data).
- Admins can read and update participants, results, and imports.
- Audit logs are write-only for admins and read-only for super admins.

## Proposed Tables (MariaDB SQL)

```sql
create table if not exists admins (
  id char(36) primary key default (uuid()),
  email text unique,
  name text,
  pid varchar(64),
  first_name text,
  last_name text,
  phone text unique,
  password_hash text,
  role text not null default 'super-admin',
  must_change_password boolean default false,
  sessions_revoked_at timestamp null,
  created_at timestamp default current_timestamp
);

create table if not exists teams (
  tnmt_id text primary key,
  team_name text not null,
  slug text unique
);

create table if not exists people (
  pid text primary key,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  birth_month int,
  birth_day int,
  city text,
  region text,
  country text,
  tnmt_id text references teams(tnmt_id),
  did text,
  team_captain boolean default false,
  team_order int,
  optional_events tinyint(1) not null default 0,
  optional_best_3_of_9 tinyint(1) not null default 0,
  optional_scratch tinyint(1) not null default 0,
  optional_all_events_hdcp tinyint(1) not null default 0,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp
);

create table if not exists doubles_pairs (
  did text primary key,
  pid text not null references people(pid),
  partner_pid text references people(pid),
  partner_first_name text,
  partner_last_name text
);

create table if not exists scores (
  id char(36) primary key default (uuid()),
  pid text not null references people(pid),
  event_type text not null check (event_type in ('team','doubles','singles')),
  lane text,
  game1 int,
  game2 int,
  game3 int,
  entering_avg int,
  handicap int,
  updated_at timestamp default current_timestamp
);

create unique index if not exists scores_pid_event_unique
  on scores (pid, event_type);

create table if not exists audit_logs (
  id char(36) primary key default (uuid()),
  admin_email text not null,
  pid text not null references people(pid),
  field text not null,
  old_value text,
  new_value text,
  changed_at timestamp default current_timestamp
);

create table if not exists participant_login_tokens (
  token varchar(512) primary key,
  pid text not null references people(pid),
  expires_at timestamp not null,
  used_at timestamp,
  created_at timestamp default current_timestamp
);

create table if not exists admin_actions (
  id char(36) primary key default (uuid()),
  admin_email text not null,
  action text not null,
  details text,
  created_at timestamp default current_timestamp
);

create table if not exists admin_password_resets (
  id char(36) primary key default (uuid()),
  admin_id char(36) not null references admins(id),
  token text not null unique,
  expires_at timestamp not null,
  used_at timestamp,
  created_at timestamp default current_timestamp
);

create table if not exists portal_settings (
  setting_key varchar(128) primary key,
  setting_value text not null,
  updated_at timestamp default current_timestamp on update current_timestamp
);
```

Schema file: `portal_docs/sql/portal_schema.sql`

## Scores Table: Book Average and Handicap

### Overview

The `scores` table stores both game scores and bowling averages for participants:

- **entering_avg** (book average): The participant's official USBC book average, imported from IGBO XML or manually entered by admins
- **handicap**: Automatically calculated from book average using the formula `floor((225 - bookAverage) * 0.9)`

### Unique Constraint Requirement

The `scores` table has a unique constraint on `(pid, event_type)` to ensure each participant has exactly one score record per event type (team, doubles, singles).

**Why this matters:**
- Without the unique constraint, `INSERT ... ON DUPLICATE KEY UPDATE` creates new records instead of updating existing ones
- This causes duplicate score records to accumulate with each XML import
- The unique constraint enables idempotent imports (safe to run multiple times)

**Migration script:** `backend/scripts/migrations/add-scores-unique-constraint.sh`

The migration:
1. Removes any existing duplicate records (keeping the most recent)
2. Adds unique index `pid_event_unique` on `(pid, event_type)`
3. Runs automatically during portal deployment via `deploy_scripts/lib/deploy-portal.sh`

See [MIGRATIONS.md](../deploy_docs/MIGRATIONS.md) for details on the migration system.

### Handicap Calculation

**Formula:** `handicap = floor((225 - bookAverage) * 0.9)`

**Where calculated:**
- **XML Import** (`src/utils/portal/importIgboXml.js`): Extracts book average from XML, stores in database
- **Participant Edit** (`src/utils/portal/participant-db.js`): Auto-calculates when admin updates book average
- **Never editable:** Handicap input was removed from edit forms to prevent incorrect manual values

**Example calculations:**
- Book average 170 → Handicap = floor((225 - 170) * 0.9) = floor(49.5) = 49
- Book average 200 → Handicap = floor((225 - 200) * 0.9) = floor(22.5) = 22
- Book average 225 → Handicap = floor((225 - 225) * 0.9) = 0

### Null-Preservation on Re-Import

The scores upsert in `importIgboXml.js` uses `COALESCE(VALUES(col), col)` for fields that may not be present in every import source:

```sql
on duplicate key update
  lane = COALESCE(values(lane), lane),
  game1 = COALESCE(values(game1), game1),
  game2 = COALESCE(values(game2), game2),
  game3 = COALESCE(values(game3), game3),
  entering_avg = values(entering_avg),
  handicap = values(handicap),
  updated_at = now()
```

**COALESCE fields** (`lane`, `game1`, `game2`, `game3`): If the import provides NULL for these columns, the existing database value is retained. This prevents XML re-imports from wiping out lane assignments imported via CSV, or game scores entered separately.

**Unconditional fields** (`entering_avg`, `handicap`): These always overwrite because IGBO XML always provides a book average, and handicap is auto-calculated from it.

The CSV lane import (`importLanesCsv.js`) applies the same principle using the `wouldClobberExisting(newValue, oldValue)` predicate: empty CSV cells do not overwrite existing lane values.

The CSV score import (`importScoresCsv.js`) uses both approaches: `wouldClobberExisting` at the application level to skip unchanged rows, and `COALESCE(VALUES(col), col)` in the SQL for `game1`, `game2`, `game3`. The score import never touches `lane`, `entering_avg`, or `handicap` columns.

## People Table: Division

`people.division` is derived from entering average during XML import and updated on every import.

Division rules:
- A: entering average >= 208
- B: entering average 190-207
- C: entering average 170-189
- D: entering average 150-169
- E: entering average <= 149

Migration script: `backend/scripts/migrations/add-division-column.sh`

### XML Import: Handling Attributes

IGBO XML includes attributes on the `BOOK_AVERAGE` element:

```xml
<BOOK_AVERAGE verified="YES">170</BOOK_AVERAGE>
```

The `fast-xml-parser` library converts this to an object:

```javascript
{
  '#text': 170,
  '@_verified': 'YES'
}
```

**Import fix** (`src/utils/portal/importIgboXml.js` line 104):
```javascript
const bookAvg = toNumber(person.BOOK_AVERAGE?.['#text'] ?? person.BOOK_AVERAGE);
```

This handles both attribute-based and simple text content.

## People Table: Optional Events Flags

### Overview

The `people` table includes opt-in flags for optional bowling competitions. Participants opt into each event separately; the flags are imported via CSV (not XML).

### Columns

| Column | Type | Description |
|---|---|---|
| `optional_events` | `tinyint(1)` | Legacy flag -- 1 if the participant has opted into any optional event |
| `optional_best_3_of_9` | `tinyint(1)` | Best of 3 of 9 opt-in (top 3 handicapped games across all 9) |
| `optional_scratch` | `tinyint(1)` | Optional Scratch opt-in (total scratch by division) |
| `optional_all_events_hdcp` | `tinyint(1)` | All Events Handicapped opt-in (total of all 9 games with handicap) |

All columns default to `0`. The `optional_events` column is set to `1` if any of the three individual flags is `1`.

### CSV Import

The optional events CSV import uses **replace-all semantics**: participants not present in the CSV have all flags set to `0`. This differs from the score and lane imports, which use null-preservation (COALESCE).

**Matching:** Primary match by EID (mapped to `people.pid`). Falls back to normalized name match if the EID is not found and the name matches exactly one participant.

**Import logic:** `src/utils/portal/importOptionalEventsCsv.js`

**API route:** `POST /api/portal/admin/optional-events/import` (supports preview and import modes)

### Migration

Migration script: `backend/scripts/migrations/add-optional-events-column.sh`

The migration adds four columns to `people` after the existing `scratch_masters` column. It is idempotent and uses `ADD COLUMN IF NOT EXISTS` for the individual opt-in columns.

## Portal Settings Table

### Overview

The `portal_settings` table is a generic key-value store for portal configuration. It is auto-created on first use by `ensurePortalSettingsTable()` in `src/utils/portal/portal-settings-db.js`.

### Schema

```sql
create table if not exists portal_settings (
  setting_key varchar(128) primary key,
  setting_value text not null,
  updated_at timestamp default current_timestamp on update current_timestamp
);
```

### Current Settings

| Key | Values | Description |
|---|---|---|
| `participants_can_view_scores` | `"0"` / `"1"` | Controls participant access to the scores page |
| `participants_can_view_scratch_masters` | `"0"` / `"1"` | Controls participant access to Scratch Masters |
| `participants_can_view_optional_events` | `"0"` / `"1"` | Controls participant access to Optional Events |

All visibility settings default to `"0"` (hidden from participants) when not present in the table. Admins always have access regardless of the toggle state.

### Implementation

- **DB access:** `src/utils/portal/portal-settings-db.js` -- get/set helpers for each visibility setting
- **API handler factory:** `src/utils/portal/visibility-toggle-route.js` -- `createVisibilityToggleHandler()` creates a `GET`/`PUT` handler for any visibility setting
- **React hook:** `src/hooks/portal/useVisibilityToggle.js` -- optimistic UI toggle with rollback on error
- **SSR guard:** `requireSessionWithVisibilitySSR()` in `src/utils/portal/ssr-helpers.js` -- redirects participants when a visibility toggle is off

## Scores Table: Lane Assignments

### Overview

The `scores.lane` column stores per-event lane assignments for each participant. Each participant can have up to three lane values (one per event type: team, doubles, singles).

### CSV Import

Lane assignments are imported via CSV upload (`POST /api/portal/admin/import-lanes`):

1. CSV must contain columns: `PID`, `T_Lane`, `D_Lane`, `S_Lane`
2. Each row is matched against `people.pid` in the database
3. Lane values are written to `scores.lane` using `INSERT ... ON DUPLICATE KEY UPDATE`
4. The unique constraint on `scores(pid, event_type)` ensures idempotent updates
5. Empty strings and `#N/A` values are normalized to NULL

### Audit Fields

Lane changes are tracked in `audit_logs` with these field names:
- `lane_team` -- team event lane assignment
- `lane_doubles` -- doubles event lane assignment
- `lane_singles` -- singles event lane assignment

### Implementation

- **Import logic**: `src/utils/portal/importLanesCsv.js`
- **Display builder**: `src/utils/portal/lane-assignments.js` (groups adjacent lanes into odd-lane pairs for display)
- **API routes**: `src/pages/api/portal/admin/import-lanes.js`, `src/pages/api/portal/admin/lane-assignments.js`

## Scores Table: Score CSV Import

### Overview

The score CSV import writes game scores (`game1`, `game2`, `game3`) into the `scores` table for a specific event type. Unlike the XML and lane imports, the scoring software CSV identifies bowlers by name rather than PID, requiring a name-matching step before any database writes.

### Name-Based Matching

Because the bowling center's scoring software does not track PIDs, the import matches bowlers by comparing the CSV `Bowler name` column against `CONCAT(first_name, ' ', last_name)` in the `people` table:

1. **Single match**: Bowler maps directly to a participant
2. **Multiple matches**: The CSV `Team name` column disambiguates. The comparison uses `startsWith` because the scoring software may truncate long team names
3. **No match**: Bowler is reported as unmatched and skipped during import

The matching query fetches all people with their team names and existing scores in a single query:

```sql
SELECT p.pid, p.first_name, p.last_name, t.team_name,
       s.lane, s.game1, s.game2, s.game3
FROM people p
LEFT JOIN teams t ON p.tnmt_id = t.tnmt_id
LEFT JOIN scores s ON s.pid = p.pid AND s.event_type = ?
```

### Score Upsert with Null-Preservation

The import uses the same COALESCE pattern as other imports to prevent null values from overwriting existing data:

```sql
INSERT INTO scores (id, pid, event_type, game1, game2, game3, updated_at)
VALUES (?, ?, ?, ?, ?, ?, now())
ON DUPLICATE KEY UPDATE
  game1 = COALESCE(VALUES(game1), game1),
  game2 = COALESCE(VALUES(game2), game2),
  game3 = COALESCE(VALUES(game3), game3),
  updated_at = now()
```

**Key characteristics:**
- Only `game1`, `game2`, `game3` columns are written -- the import never modifies `lane`, `entering_avg`, or `handicap`
- The unique constraint on `scores(pid, event_type)` enables idempotent upserts
- Application-level `wouldClobberExisting` check skips rows where the CSV has null but the database has an existing value, avoiding unnecessary SQL round-trips
- COALESCE in the SQL provides a second layer of null-preservation if a null reaches the database

### Cross-Reference Warnings

During preview mode, the import checks for mismatches between the CSV and existing database values:

- **Team name mismatch**: CSV `Team name` does not match the participant's database team (using `startsWith` for truncation tolerance)
- **Lane mismatch**: CSV `Lane number` differs from the participant's existing `scores.lane` value

These warnings are informational only and do not block the import.

### Audit Fields

Score changes are tracked in `audit_logs` with per-event, per-game field names:

| Event Type | Game 1 | Game 2 | Game 3 |
|---|---|---|---|
| team | `score_team_game1` | `score_team_game2` | `score_team_game3` |
| doubles | `score_doubles_game1` | `score_doubles_game2` | `score_doubles_game3` |
| singles | `score_singles_game1` | `score_singles_game2` | `score_singles_game3` |

### Implementation

- **Import logic**: `src/utils/portal/importScoresCsv.js`
- **API route**: `src/pages/api/portal/admin/import-scores.js`

## Admins Table: Session Revocation

### Overview

The `admins` table includes session management columns for security breach scenarios:

- **must_change_password** (boolean): Flags admin accounts that must change password on next login
- **sessions_revoked_at** (timestamp NULL): Timestamp when all sessions should be invalidated

### Session Revocation System

**Purpose**: Enable immediate invalidation of all admin sessions when security breach detected (compromised credentials, suspicious activity, account takeover).

**How It Works**:
1. Super admin forces password change via `POST /api/portal/admins/[id]/force-password-change`
2. Backend sets `sessions_revoked_at = NOW()` for target admin
3. Every authenticated request checks session's `iat` (issued at) timestamp
4. If `iat < sessions_revoked_at`, session is rejected (401 Unauthorized)
5. Only sessions created AFTER revocation timestamp are valid

**Column Definition**:
```sql
sessions_revoked_at TIMESTAMP NULL
```

**Values**:
- `NULL` - All sessions valid (default state)
- `2026-02-09 15:30:00` - All sessions created before this timestamp are invalid

**Migration**: `backend/scripts/migrations/add-sessions-revoked-at.sh`
- Adds column after `must_change_password`
- Defaults to NULL (existing admins unaffected)
- Idempotent (safe to run multiple times)

### Performance Impact

**Query Pattern**:
Every authenticated admin request executes:
```sql
SELECT sessions_revoked_at FROM admins WHERE email = ? LIMIT 1
```

**Characteristics**:
- **Indexed lookup**: Uses email unique constraint (fast)
- **Result size**: 1 row, 1 column (minimal data transfer)
- **Frequency**: Once per authenticated admin request
- **Latency**: 1-10ms local, 5-30ms RDS

**Affected Endpoints** (28 auth guard calls across 12 files):
- Admin dashboard and session management
- Participant CRUD operations
- Audit log access
- Email template management
- XML imports
- Admin user management

**Current Impact**: LOW
- Tournament portal has 5-10 concurrent admins typical, 20 max
- Query latency is negligible compared to request processing
- No real-time or polling features

**Optimization Strategy**:
If performance becomes an issue (response times >200ms consistently):
- Implement in-memory cache with 60-second TTL
- Cache key: admin email
- Clear cache entry on force password change
- Trade-off: Revoked sessions may remain valid up to 60 seconds

See [portal_architecture.md#performance-considerations](portal_architecture.md#performance-considerations) for detailed optimization strategies.

### Force Password Change Flow

**Database Transaction**:
```sql
-- Update admin record (atomic operation)
UPDATE admins
SET password_hash = ?,
    must_change_password = true,
    sessions_revoked_at = NOW()
WHERE id = ?;

-- Log admin action
INSERT INTO admin_actions (id, admin_email, action, details)
VALUES (?, ?, 'force_password_change', ?);
```

**Session Token Structure**:
```javascript
{
  email: "admin@example.com",
  role: "super-admin",
  iat: 1707493800000  // Issued at timestamp (milliseconds)
}
```

**Validation Logic**:
```javascript
// Auth guard checks
const sessionCreatedAt = adminSession.iat;
const revocationTime = new Date(sessionsRevokedAt).getTime();

if (sessionCreatedAt < revocationTime) {
  // Session created before revocation - invalid
  return false;
}
```

### Password Change Enforcement

**Flow**:
1. Admin logs in with temporary password
2. `must_change_password` flag detected
3. Redirected to `/portal/admin/reset` with secure reset cookie
4. Backend validates new password is different from current password
5. Sets `must_change_password = false` after successful reset

**Password Reuse Prevention**:
```javascript
// Compare new password with current hash
const isSamePassword = await bcrypt.compare(newPassword, currentHash);
if (isSamePassword) {
  return error("New password must be different from current password");
}
```

### Related Tables

**admin_password_resets**:
Tracks password reset tokens for the reset flow:
```sql
create table if not exists admin_password_resets (
  id char(36) primary key default (uuid()),
  admin_id char(36) not null references admins(id),
  token text not null unique,
  expires_at timestamp not null,
  used_at timestamp,
  created_at timestamp default current_timestamp
);
```

**admin_actions**:
Logs all force password change actions:
```sql
create table if not exists admin_actions (
  id char(36) primary key default (uuid()),
  admin_email text not null,
  action text not null,
  details text,
  created_at timestamp default current_timestamp
);
```

Example action log entry:
```json
{
  "admin_email": "superadmin@example.com",
  "action": "force_password_change",
  "details": {
    "targetAdminId": "550e8400-e29b-41d4-a716-446655440000",
    "targetAdminEmail": "targetadmin@example.com"
  }
}
```

### Test Coverage

BDD tests verify session revocation behavior:
- `tests/unit/session-revocation-auth-guards.test.js` (10 tests)
  - Sessions created before revocation are rejected
  - Sessions created after revocation are accepted
  - NULL revocation timestamp allows all sessions
  - Each auth guard type validated
- `tests/unit/admin-force-password-change-api.test.js` (8 tests)
  - Force password change sets all three columns
  - Cannot force change on own account
  - Super admin authorization required
  - Email sent with temporary password
- `tests/unit/password-reset-no-reuse.test.js` (6 tests)
  - Cannot reuse current password
  - Password comparison using bcrypt
  - Reset flow validation

## Indexing (initial)

- `people.email`, `people.phone`
- `people.last_name`, `people.first_name`
- `scores.pid`, `scores.event_id`
- `scores(pid, event_type)` - unique constraint for upserts
- `audit_logs.admin_id`, `audit_logs.created_at`
- `admins.email` - unique constraint (also serves as index for session revocation queries)
