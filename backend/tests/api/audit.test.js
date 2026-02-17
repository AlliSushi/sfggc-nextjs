import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAuditEntries } from "../../../src/utils/portal/audit.js";

test("Given field changes, when building audit entries, then admin and fields are captured", () => {
  const changes = [
    { field: "email", oldValue: "old@example.com", newValue: "new@example.com" },
    { field: "scores_team", oldValue: [100, 120, 130], newValue: [150, 160, 170] },
  ];

  const entries = buildAuditEntries("admin@example.com", "000104", changes);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].admin_email, "admin@example.com");
  assert.equal(entries[0].pid, "000104");
  assert.equal(entries[0].field, "email");
  assert.equal(entries[0].old_value, "old@example.com");
  assert.equal(entries[0].new_value, "new@example.com");
  assert.match(entries[1].new_value, /150/);
});

test("Given no changes, when building audit entries, then no entries are returned", () => {
  const entries = buildAuditEntries("admin@example.com", "000104", []);
  assert.equal(entries.length, 0);
});
