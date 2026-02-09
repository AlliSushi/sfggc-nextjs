---
title: Portal Database Architecture
updated: 2026-01-29
---

## Summary

Use MariaDB as the source of truth. Keep schema normalized for participants, teams, doubles pairs, events, scores, and audits. Preserve imported IDs (PID, TnmtID, DID) for traceability.

## Core Entities

- **people**: PID, name, email/phone, demographics, status
- **admins**: auth user id, role, status
- **admin_roles**: role name and permissions (optional if using enum)
- **teams**: TnmtID, team name
- **doubles_pairs**: DID, partner IDs, partner name fields
- **events**: event type, tournament reference
- **scores**: per-event per-game scores
- **tournaments**: tournament metadata
- **audit_logs**: admin actions and changes

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
  first_name text,
  last_name text,
  phone text unique,
  password_hash text,
  role text not null default 'super-admin',
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

## Indexing (initial)

- `people.email`, `people.phone`
- `people.last_name`, `people.first_name`
- `scores.pid`, `scores.event_id`
- `scores(pid, event_type)` - unique constraint for upserts
- `audit_logs.admin_id`, `audit_logs.created_at`
