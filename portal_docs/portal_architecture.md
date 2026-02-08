---
title: Portal Architecture
updated: 2026-01-29
---

## Summary

The portal is a single-repo setup with a Next.js frontend and Next.js API routes for backend functionality. The frontend handles routing and UI, while the API routes provide authenticated access, data updates, and audit logging. For local development we use MariaDB; production auth is handled via email/password with cookie sessions.

## Components

- **Frontend (Next.js)**: `src/pages/portal/*` for portal routes and `src/components/Portal/*` for UI.
- **Backend API (Next.js API routes)**: `src/pages/api/portal/*` for API endpoints.
- **Database (MariaDB)**: primary source of truth for participants, teams, results, and logs.
- **Admin scripts**: `backend/scripts/admin/*` for operational tooling (create super admin).

## Request Flow

1. User visits `/portal` and selects participant or admin.
2. Frontend calls backend API for auth flow (magic link for participants, managed auth for admins).
3. Backend validates auth, issues session, and serves protected data.
4. Frontend renders participant or admin views using API responses.
5. Admins can open a participant preview view from the admin dashboard.

## Environments

- **Local**: Frontend + backend + local MariaDB with seeded sample data.
- **Staging**: MariaDB with seeded sample data.
- **Production**: MariaDB with live data and admin-managed imports.

## Test Automation (BDD)

- Test scripts auto-create and drop `<db>_test` after successful runs.
- On failures, the test database is preserved for debugging.

## Security

- Admin auth uses email/password with cookie-based sessions (6-hour idle timeout).
- Participant login uses single-use magic links (30-minute expiry) that create a 48-hour session.
- Audit log records admin edits and imports.
- API routes enforce admin session checks where required.

## Proposed Auth Flows (text graphics)

Participant magic link (no user enumeration):

```
Browser -> Next.js UI -> Backend API -> Auth provider -> Email
   |            |             |              |             |
   |  submit    |             |              |             |
   | email      |             |              |             |
   |----------->|  POST /auth/participant/start          |
   |            |--------------------------------------->|
   |            |             |     create magic link     |
   |            |             |------------------------->|
   |            |             |    send email link        |
   |            |             |<-------------------------|
   |  always show "check your email" acknowledgement     |
   |<-----------|                                             |
```

Admin email/password auth:

```
Browser -> Next.js UI -> Backend API -> Session Cookie
   |            |                 |               |            |
   | login      |                 |               |
   |----------->|  POST /api/portal/admin/login   |
   |            |------------------------------->|
   |            |     validate + set cookie       |
   |            |<-------------------------------|
   |  route to /portal/admin                                  |
   |<-----------|                                             |
```

Admin view-as participant (preview):

```
Browser -> Admin UI -> Backend API -> Database
   |          |            |            |
   | select   |            |            |
   | participant           |            |
   |----------> open preview           |
   |          | GET /admin/view-as/:pid |
   |          |----------------------->|
   |          |   authorized read       |
   |          |<-----------------------|
   |    render participant view (read-only) |
```

## Admin Preview UX (minimal)

Goal: allow admins to see participant views without role changes or writes.

UI behaviors:

- Always show a top banner: "Preview mode — you are viewing this as admin."
- Provide a clear "Exit preview" action back to the admin dashboard.
- Render all participant fields in read-only mode (no edit controls).
- Show context chip with participant name and PID.

Acceptance criteria (BDD-style):

- Given I am an admin, when I open "View as participant", then I see a preview banner.
- Given I am in preview mode, when I attempt to edit a field, then editing is disabled.
- Given I am in preview mode, when I click "Exit preview", then I return to the admin dashboard.
- Given I am in preview mode, then I can see participant scores and lanes but cannot modify them.

## MVP Endpoints (current)

- `POST /api/portal/admin/login`
- `GET /api/portal/admin/session`
- `GET /api/portal/admin/refresh`
- `POST /api/portal/admin/import-xml`
- `POST /api/portal/participant/login`
- `GET /api/portal/participant/verify`
- `GET /api/portal/participant/session`
- `POST /api/portal/participant/logout`
- `GET /api/portal/participants/:pid`
- `GET /api/portal/participants?search=`
- `PATCH /api/portal/participants/:pid`
- `GET /api/portal/participants/:pid/audit`
- `POST /api/portal/admin/logout`
- `GET /api/portal/admin/admins`
- `POST /api/portal/admin/admins`
- `GET /api/portal/admin/audit`
- `DELETE /api/portal/admin/audit`

## Proposed API Contracts (initial)

All responses are JSON. Error messages for auth should be generic.

`POST /api/portal/admin/login`

Request:
```
{
  "email": "string",
  "password": "string"
}
```

Response (always success):
```
{
  "ok": true,
  "email": "string",
  "role": "super-admin | tournament-admin | results-manager"
}
```

`GET /api/portal/admin/session`

Request:
```
{
{
  "ok": true,
  "admin": {
    "email": "string",
    "role": "string"
  }
}
```

`GET /api/portal/participants/:pid`

Response:
```

`GET /portal/admin/preview/:pid` (UI route)

Response:
```
{
  "mode": "admin-preview",
  "participant": {
    "pid": "string",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string",
    "team": {
      "tnmtId": "string",
      "name": "string"
    },
    "doubles": {
      "did": "string",
      "partnerPid": "string"
    },
    "lanes": {
      "team": "string",
      "doubles": "string",
      "singles": "string"
    },
    "averages": {
      "entering": "number",
      "handicap": "number"
    },
    "scores": {
      "team": [ "number", "number", "number" ],
      "doubles": [ "number", "number", "number" ],
      "singles": [ "number", "number", "number" ]
    }
  }
}
```
{
  "pid": "string",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string",
  "team": {
    "tnmtId": "string",
    "name": "string"
  },
  "doubles": {
    "did": "string",
    "partnerPid": "string"
  },
  "lanes": {
    "team": "string",
    "doubles": "string",
    "singles": "string"
  },
  "averages": {
    "entering": "number",
    "handicap": "number"
  },
  "scores": {
    "team": [ "number", "number", "number" ],
    "doubles": [ "number", "number", "number" ],
    "singles": [ "number", "number", "number" ]
  }
}
```

`GET /api/portal/participants?search=`

Response:
```
[
  {
    "pid": "string",
    "first_name": "string",
    "last_name": "string",
    "email": "string",
    "team_name": "string"
  }
]
```

`PATCH /api/portal/participants/:pid`

Request (partial):
```
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string",
  "team": {
    "tnmtId": "string",
    "name": "string"
  },
  "doubles": {
    "did": "string",
    "partnerPid": "string"
  }
}
```

Response:
```
{
  "ok": true
}
```

`POST /api/portal/admin/import-xml`

Request:
```
{
  "xml": "multipart form field"
}
```

Response:
```
{
  "ok": true,
  "summary": {
    "people": "number",
    "teams": "number",
    "doubles": "number",
    "scores": "number"
  }
}
```

## Data Import

- CSV seed script for local/staging data.
- XML import via admin dashboard and `/api/portal/admin/import-xml`.
