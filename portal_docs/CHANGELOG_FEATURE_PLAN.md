# Plan: Add Change Log to Admin Detail, Team Detail, and Admins List Pages

## Context

The participant detail page (`/portal/participant/[pid]`) has a "Change log" section at the bottom showing audit entries (who changed what, when). The user wants the same change log replicated on three additional pages:
1. **Admin detail** (`/portal/admin/admins/[id]`)
2. **Team detail** (`/portal/team/[teamSlug]`)
3. **Admins list** (`/portal/admin/admins`)

The existing implementation uses an `AuditLogTable` component fed by a `useEffect` + `portalFetch` pattern. DRY requires extracting the repeated fetch logic into a shared hook and reusing the existing component.

## Existing Infrastructure

| Asset | Path | Purpose |
|---|---|---|
| AuditLogTable | `src/components/Portal/AuditLogTable/AuditLogTable.js` | Stateless table: When, Admin, Field, Old, New |
| Participant audit API | `src/pages/api/portal/participants/[pid]/audit.js` | Returns `audit_logs` for one PID (limit 20) |
| Inline fetch pattern | `src/pages/portal/participant/[pid].js:115-123` | useState + useEffect + portalFetch |
| admin_actions table | Created by `ensureAdminActionsTables()` | Stores: id, admin_email, action, details (JSON), created_at |
| audit_logs table | Schema in `portal_docs/sql/portal_schema.sql` | Stores: id, admin_email, pid, field, old_value, new_value, changed_at |
| useAdminSession hook | `src/hooks/portal/useAdminSession.js` | Existing custom hook pattern to follow |

## Data Shape

`AuditLogTable` expects: `{ id, changed_at, admin_email, field, old_value, new_value }`

- **audit_logs** already matches this shape (used for participant and team pages)
- **admin_actions** needs server-side transformation:
  - `modify_admin` → expand `details.before/after` into one row per changed field
  - `force_password_change` → single row: field="force_password_change", new_value=targetAdminEmail
  - `revoke_admin` → single row: field="revoke_admin", old_value=revokedRole, new_value=revokedEmail

## New Files

### 1. `src/hooks/portal/useAuditLog.js` — Shared fetch hook

Extracts the repeated useState+useEffect+portalFetch pattern. Accepts `url` (null to skip) and optional `refreshKey` (triggers re-fetch when changed, e.g. `isEditing`).

```javascript
const useAuditLog = (url, refreshKey) => {
  const [auditLogs, setAuditLogs] = useState([]);
  useEffect(() => {
    if (!url) { setAuditLogs([]); return; }
    portalFetch(url)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAuditLogs(data); })
      .catch(() => setAuditLogs([]));
  }, [url, refreshKey]);
  return auditLogs;
};
```

### 2. `src/utils/portal/transform-admin-actions.js` — Pure transformation function

Converts `admin_actions` rows → `AuditLogTable`-compatible rows. One `modify_admin` action may produce multiple output rows (one per changed field). Pure function, no DB access, easy to test.

### 3. `src/pages/api/portal/admins/[id]/audit.js` — Admin-specific audit endpoint

- Auth: `await requireSuperAdmin(req, res)`
- Query: `admin_actions` WHERE admin ID appears in details JSON (using LIKE on details column for adminId, targetAdminId, and revokedEmail)
- Transform: Pipe through `transformAdminActions()`
- Returns: Array matching AuditLogTable shape, limit 20, desc order

### 4. `src/pages/api/portal/teams/[teamSlug]/audit.js` — Team member audit endpoint

- Auth: `await requireSuperAdmin(req, res)`
- Query: Look up team by slug → get member PIDs → `audit_logs WHERE pid IN (...)`
- Returns: Array matching AuditLogTable shape, limit 20, desc order
- **Structural change**: Move `teams/[teamSlug].js` → `teams/[teamSlug]/index.js` (same pattern as `admins/[id]/index.js`)

### 5. `src/pages/api/portal/admin/admin-actions.js` — Global admin actions endpoint

- Auth: `await requireSuperAdmin(req, res)`
- Query: Recent `admin_actions` (all admins), limit 20, desc order
- Transform: Pipe through `transformAdminActions()`
- Returns: Array matching AuditLogTable shape

## Modified Files

### Frontend Pages (add change log)

| File | Changes |
|---|---|
| `src/pages/portal/participant/[pid].js` | Replace inline audit useState+useEffect (lines 85,115-123) with `useAuditLog` hook |
| `src/pages/portal/admin/admins/[id].js` | Import `useAuditLog` + `AuditLogTable`. Add useAuditLog call + render after card section, before modals |
| `src/pages/portal/team/[teamSlug].js` | Import `useAuditLog` + `AuditLogTable`. Gate behind `adminRole === "super-admin"`. Render after TeamProfile |
| `src/pages/portal/admin/admins/index.js` | Import `useAuditLog` + `AuditLogTable`. Render after admins table. Refresh when `admins` state changes |

### Existing Tests (update)

| File | Changes |
|---|---|
| `tests/unit/auth-guard-await.test.js` | Add 3 new entries to `AUTH_GUARD_CALLERS`: admins/[id]/audit.js, teams/[teamSlug]/audit.js, admin/admin-actions.js |
| `tests/frontend/portal-routes.test.js` | Add route existence checks for new API endpoints; update teams/[teamSlug].js → [teamSlug]/index.js |

## New Tests

| File | What it tests |
|---|---|
| `tests/unit/transform-admin-actions.test.js` | Behavioral: modify_admin expands to field-level rows, force_password_change/revoke_admin produce single rows, unparseable JSON falls back gracefully |
| `tests/unit/use-audit-log-hook.test.js` | Source analysis: hook exports default, uses useState+useEffect, handles null URL, catches errors |
| `tests/unit/changelog-apis.test.js` | Source analysis for all 3 new API endpoints: await auth guard, query correct table, import transform, return JSON |
| `tests/unit/changelog-dry.test.js` | DRY enforcement: all 4 pages import useAuditLog + AuditLogTable, no inline audit fetch patterns |

## Implementation Order (BDD Sprints)

### Sprint 1: Shared Infrastructure
1. RED: Write `transform-admin-actions.test.js` → fails (file missing)
2. GREEN: Create `transform-admin-actions.js`
3. RED: Write `use-audit-log-hook.test.js` → fails (file missing)
4. GREEN: Create `useAuditLog.js`

### Sprint 2: API Endpoints
5. RED: Write `changelog-apis.test.js` → fails (files missing)
6. GREEN: Create `admins/[id]/audit.js`
7. GREEN: Move `teams/[teamSlug].js` → `teams/[teamSlug]/index.js`, create `teams/[teamSlug]/audit.js`
8. GREEN: Create `admin/admin-actions.js`
9. Update `auth-guard-await.test.js` + `portal-routes.test.js` for new files

### Sprint 3: Frontend Integration
10. RED: Write `changelog-dry.test.js` → fails (pages don't use hook yet)
11. GREEN: Refactor participant page to use `useAuditLog` hook
12. GREEN: Add change log to admin detail page
13. GREEN: Add change log to team detail page
14. GREEN: Add change log to admins list page

### Sprint 4: Validation
15. Run `bash scripts/test/test-all.sh` for full suite verification

## Verification

1. Visit `/portal/participant/[pid]` — change log still works (regression check after refactor to hook)
2. Visit `/portal/admin/admins/[id]` — change log appears showing modify/force-password-change/revoke actions
3. Visit `/portal/team/[teamSlug]` as super-admin — change log shows participant edits for team members
4. Visit `/portal/admin/admins` — change log shows recent admin management activity
5. All tests pass: `bash scripts/test/test-all.sh`
