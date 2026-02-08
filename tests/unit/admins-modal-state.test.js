const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const loadAdminUtils = async () => {
  const fullPath = path.join(process.cwd(), "src/utils/portal/admins-client.js");
  const module = await import(pathToFileURL(fullPath));
  return module;
};

test(
  "Given an admin lookup match, when resolving modal state, then show existing admin state",
  async () => {
    const { resolveAdminLookupStep } = await loadAdminUtils();
    const step = resolveAdminLookupStep({ admin: { id: "1" }, participant: null });
    assert.equal(step, "existing-admin");
  }
);

test(
  "Given a participant lookup match, when resolving modal state, then redirect to participant",
  async () => {
    const { resolveAdminLookupStep } = await loadAdminUtils();
    const step = resolveAdminLookupStep({ admin: null, participant: { pid: 123 } });
    assert.equal(step, "participant");
  }
);

test(
  "Given no lookup match, when resolving modal state, then show create form",
  async () => {
    const { resolveAdminLookupStep } = await loadAdminUtils();
    const step = resolveAdminLookupStep({ admin: null, participant: null });
    assert.equal(step, "create");
  }
);

test(
  "Given an email lookup value, when building prefill, then email is set",
  async () => {
    const { buildAdminPrefill } = await loadAdminUtils();
    const prefill = buildAdminPrefill("test@example.com");
    assert.deepEqual(prefill, { email: "test@example.com", phone: "" });
  }
);

test(
  "Given a phone lookup value, when building prefill, then phone is set",
  async () => {
    const { buildAdminPrefill } = await loadAdminUtils();
    const prefill = buildAdminPrefill("5551234567");
    assert.deepEqual(prefill, { email: "", phone: "5551234567" });
  }
);
