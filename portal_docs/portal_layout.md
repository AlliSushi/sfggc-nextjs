---
title: Portal Layout
updated: 2026-01-29
---

## Purpose

This document captures the agreed single-repo layout for the portal frontend, backend, and admin tooling. It follows the existing project patterns: Next.js pages in `src/pages/`, feature components under `src/components/`, and a dedicated `backend/` directory for the portal service.

## Repository Layout (additions)

```
sfggc-nextjs/
  portal_docs/
    portal_mvp_fast_track.md
    portal_layout.md
    portal_architecture.md
    portal_database_architecture.md
    sql/
      portal_schema.sql
    sample_data/

  backend/
    src/
      routes/
        auth.js
        participants.js
        admin.js
        results.js
      scripts/
        seed/
          seed-from-csv.js
    scripts/
      admin/
        create-super-admin.sh
    tests/
      api/
        routes.test.js
        audit.test.js
        session.test.js
        import-igbo-xml.test.js
        create-super-admin.test.js

  src/
    pages/
      portal/
        index.js
        participant/
          index.js
          ack.js
      admin/
        index.js
        reset.js
        dashboard.js
        participants/
          [pid].js
        preview/
          [pid].js
      api/
        portal/
          admin/
            login.js
            session.js
            import-xml.js
          participants/
            index.js
            [pid].js
            [pid]/
              audit.js
    components/
      Portal/
        RoleChooser.js
        ParticipantLookupForm.js
        AdminLoginForm.js
        AckMessage.js
        PortalShell.js
      __tests__/
        portal/
          role-chooser.test.js
          admin-login-form.test.js
    utils/
      portal/
        api.js
        audit.js
        db.js
        importIgboXml.js
        session.js
        validators.js

  tests/
    frontend/
      portal-routes.test.js
    helpers/
      api-server.js
      test-db.js
    unit/
      sample-data.test.js
      portal-api.test.js
      import-igbo-xml-db.test.js
  scripts/
    test/
      test-all.sh
      test-frontend.sh
      test-backend.sh
    dev/
      install-mariadb-macos.sh
      install-mariadb-ubuntu.sh
      init-portal-db.sh
      start-mariadb.sh
      bootstrap-dev.sh
      start-frontend.sh
```

## Notes

- Frontend portal pages live under `src/pages/portal/` to keep routing aligned with the main site.
- Portal UI components live under `src/components/Portal/` to follow the existing feature-folder pattern.
- Backend code is isolated under `backend/` to keep API and data concerns separate from the static site.
- Admin scripts live under `backend/scripts/admin/` for convenience while keeping them out of request paths.
- Frontend tests live under `tests/frontend/`.
- Shared unit/integration tests live under `tests/unit/` and `tests/helpers/`.
- Backend API/script tests live under `backend/tests/api/`.
- Test runner scripts live under `scripts/test/`.
