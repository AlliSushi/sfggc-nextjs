import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

/**
 * BDD tests for admin detail page SSR performance.
 *
 * The admin detail page previously made 2 sequential API calls in
 * getServerSideProps: one for the admin, and one for ALL admins
 * (just to count super-admins for the revoke button logic).
 *
 * The fix: include superAdminCount in the single admin API response,
 * eliminating the second fetch entirely.
 */

const ADMIN_DETAIL_PAGE = path.join(
  process.cwd(),
  "src/pages/portal/admin/admins/[id].js"
);
const ADMIN_API = path.join(
  process.cwd(),
  "src/pages/api/portal/admins/[id]/index.js"
);

test(
  "Given the admin detail API, when returning a single admin, then it includes superAdminCount in the response",
  () => {
    const content = fs.readFileSync(ADMIN_API, "utf-8");

    // The GET handler must query the super-admin count
    assert.ok(
      content.match(/super.admin/i) && content.match(/count/i) &&
      content.match(/handleGet[\s\S]*?superAdminCount|super_admin_count|superadmincount/i),
      "Admin GET handler must include super-admin count in the response"
    );
  }
);

test(
  "Given the admin detail page SSR, when loading admin data, then it does NOT fetch the full admins list",
  () => {
    const content = fs.readFileSync(ADMIN_DETAIL_PAGE, "utf-8");

    // getServerSideProps must NOT fetch /api/portal/admins (the list endpoint)
    const ssrMatch = content.match(
      /getServerSideProps[\s\S]*$/
    );
    assert.ok(ssrMatch, "getServerSideProps must exist");

    const ssrBody = ssrMatch[0];

    // Should NOT have a separate fetch to the admins list endpoint
    const fetchesAdminList = ssrBody.match(
      /fetch\s*\(\s*[`"'].*\/api\/portal\/admins[`"']\s*[,)]/
    );
    assert.ok(
      !fetchesAdminList,
      "getServerSideProps must NOT fetch the full admins list (/api/portal/admins) — " +
      "superAdminCount should come from the single admin endpoint"
    );
  }
);

test(
  "Given the admin detail page SSR, when extracting superAdminCount, then it reads it from the admin API response",
  () => {
    const content = fs.readFileSync(ADMIN_DETAIL_PAGE, "utf-8");

    const ssrMatch = content.match(
      /getServerSideProps[\s\S]*$/
    );
    assert.ok(ssrMatch, "getServerSideProps must exist");

    const ssrBody = ssrMatch[0];

    // superAdminCount should be extracted from the admin response object
    assert.ok(
      ssrBody.includes("superAdminCount"),
      "getServerSideProps must pass superAdminCount to props"
    );
  }
);
