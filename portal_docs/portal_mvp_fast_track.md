---
name: Portal MVP Fast Track
overview: Deliver a Feb 12 portal MVP quickly using a slim backend service, managed auth, MariaDB, and small BDD story slices driven by CSV-based seed data.
todos:
  - id: seed-postgres
    content: Define schema + CSV seed script for sample data
    status: pending
  - id: admin-readonly
    content: Read-only admin dashboard + search/filter
    status: pending
  - id: admin-edit-audit
    content: Admin edit participant with audit logging
    status: pending
  - id: admin-auth-ui
    content: Admin login flow (managed auth) + admin entry UI
    status: pending
  - id: admin-bootstrap
    content: Admin bootstrap flow (create super admin + first login)
    status: pending
  - id: admin-session
    content: Admin session handling (timeout + re-auth)
    status: pending
  - id: admin-view-as
    content: Admin view-as participant (read-only preview)
    status: pending
  - id: participant-readonly
    content: Read-only participant profile from backend API
    status: pending
  - id: participant-auth-ui
    content: Participant magic-link request + acknowledgement UI
    status: pending
  - id: test-runners
    content: Add test runner scripts for unit, frontend e2e, backend
    status: pending
isProject: false
---

## Approach

- Use a separate backend optimized for speed: Node.js + Hono (minimal boilerplate, fast REST), MariaDB, and managed auth.
- Keep the existing Next.js repo as the portal UI; add portal pages under `src/pages/portal/` and components under `src/components/Portal/`.
- Prototype against CSV-derived seed data loaded into MariaDB; wire API calls to the backend as soon as the first endpoints exist.

## Story Map (small vertical slices)

- Slice 1: Admin login flow with managed auth provider UI and redirect to `/portal/admin`.
- Slice 2: Admin bootstrap: create super admin + first login (script + verification).
- Slice 3: Admin session handling (timeout + re-auth UX).
- Slice 4: Admin basic dashboard: list participants, basic search/filter (read-only).
- Slice 5: Admin view-as participant (read-only preview using participant PID).
- Slice 6: Admin edit participant info (write), with audit log table.
- Slice 7: Results import placeholder endpoint + upload UI (no parsing yet).
- Slice 8: Participant profile page with data pulled from seeded CSV tables (read-only).
- Slice 9: Participant login flow with "email submit → acknowledgment" using a magic-link API (single-use, 30-minute expiry, 48-hour session). SMS/phone login deferred.

## BDD/Agile practice setup

- Use lightweight BDD for each slice: 2–5 Given/When/Then acceptance criteria per slice (start with Slice 1–3).
- Run front-end tests with Playwright (or Cypress) for critical flows; API tests with Vitest + Supertest.
- Define a single “definition of done” checklist for every slice: UI complete, API stub or real, tests passing, seeded data works, deployed preview.

## Data modeling and CSV prototype

- Create core tables first: `people`, `teams`, `doubles_pairs`, `events`, `scores`, `tournaments`, `audit_logs`.
- Write a one-off CSV import script to seed MariaDB; use CSV fields from `sample_data/` as input.
- Keep IDs stable (PID, TnmtID, DID) and map them directly in the seed process.

## Environments and deployments

- Use MariaDB for staging/prod; set up separate databases for each.
- Deploy backend via Vercel/Render/Fly (fast deploy) with env vars for MariaDB.
- Keep frontend on the existing deploy pipeline; configure API base URL per environment.

## Key files/directories (frontend)

- Pages: `src/pages/portal/index.js`, `src/pages/portal/participant/index.js`, `src/pages/portal/participant/ack.js`, `src/pages/portal/admin/index.js`, `src/pages/portal/admin/reset.js`
- Components: `src/components/Portal/*`
- Utils: `src/utils/portal/*` for fetchers and validators

## Key files/directories (backend)

- `src/routes/auth.ts`, `src/routes/participants.ts`, `src/routes/admin.ts`, `src/routes/results.ts`
- `src/db/schema.ts` (Prisma/Drizzle) or SQL migrations folder
- `src/scripts/seed-from-csv.ts`

## Risks and mitigations

- Auth complexity: use managed auth to avoid custom token flows.
- Data model uncertainty: start with read-only endpoints and expand gradually.
- Timeline: keep each slice at 1–2 days max, with strict scope control.
