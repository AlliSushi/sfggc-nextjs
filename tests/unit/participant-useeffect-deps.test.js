import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

/**
 * BDD tests for participant page useEffect dependency optimization.
 *
 * The linked admin lookup useEffect should only depend on participant email
 * and admin role. UI state like modal visibility (showMakeAdmin, showRevokeAdmin)
 * should NOT trigger re-fetches because toggling a modal doesn't change
 * whether the participant is linked to an admin.
 */

const PARTICIPANT_PAGE_PATH = path.join(
  process.cwd(),
  "src/pages/portal/participant/[pid].js"
);

test(
  "Given the participant page, when the linked admin lookup useEffect runs, then showMakeAdmin is NOT in the dependency array",
  () => {
    const content = fs.readFileSync(PARTICIPANT_PAGE_PATH, "utf-8");

    // Find the useEffect that fetches /api/portal/admins/lookup
    const lookupEffect = content.match(
      /useEffect\(\s*\(\)\s*=>\s*\{[^}]*admins\/lookup[^]*?\},\s*\[([^\]]*)\]/
    );
    assert.ok(lookupEffect, "Linked admin lookup useEffect must exist");

    const deps = lookupEffect[1];
    assert.ok(
      !deps.includes("showMakeAdmin"),
      "showMakeAdmin must NOT be in the dependency array (toggling a modal should not trigger an API re-fetch)"
    );
  }
);

test(
  "Given the participant page, when the linked admin lookup useEffect runs, then showRevokeAdmin is NOT in the dependency array",
  () => {
    const content = fs.readFileSync(PARTICIPANT_PAGE_PATH, "utf-8");

    const lookupEffect = content.match(
      /useEffect\(\s*\(\)\s*=>\s*\{[^}]*admins\/lookup[^]*?\},\s*\[([^\]]*)\]/
    );
    assert.ok(lookupEffect, "Linked admin lookup useEffect must exist");

    const deps = lookupEffect[1];
    assert.ok(
      !deps.includes("showRevokeAdmin"),
      "showRevokeAdmin must NOT be in the dependency array (toggling a modal should not trigger an API re-fetch)"
    );
  }
);

test(
  "Given the participant page, when the linked admin lookup useEffect runs, then it depends on participant email and admin role only",
  () => {
    const content = fs.readFileSync(PARTICIPANT_PAGE_PATH, "utf-8");

    const lookupEffect = content.match(
      /useEffect\(\s*\(\)\s*=>\s*\{[^}]*admins\/lookup[^]*?\},\s*\[([^\]]*)\]/
    );
    assert.ok(lookupEffect, "Linked admin lookup useEffect must exist");

    const deps = lookupEffect[1];
    assert.ok(
      deps.includes("participant?.email") || deps.includes("participant.email"),
      "Must depend on participant email"
    );
    assert.ok(
      deps.includes("adminRole"),
      "Must depend on adminRole"
    );
  }
);
