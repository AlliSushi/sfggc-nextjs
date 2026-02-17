const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const GUARDS_PATH = path.join(
  process.cwd(),
  "src/utils/portal/auth-guards.js"
);
const PARTICIPANT_API_PATH = path.join(
  process.cwd(),
  "src/pages/api/portal/participants/[pid].js"
);

test(
  "Given auth guards module, when checking source, then any-session guard exists for read-only browsing",
  () => {
    const source = fs.readFileSync(GUARDS_PATH, "utf8");
    assert.ok(
      source.includes("const requireAnySession"),
      "auth-guards must define requireAnySession"
    );
    assert.ok(
      source.includes("if (!adminSession && !participantSession)"),
      "any-session guard must reject requests with no participant/admin session"
    );
    assert.ok(
      source.includes("checkSessionRevocation(adminSession)"),
      "any-session guard must still validate admin session revocation"
    );
  }
);

test(
  "Given participants [pid] API, when handling GET and PATCH, then GET allows any session while PATCH remains self-or-admin",
  () => {
    const source = fs.readFileSync(PARTICIPANT_API_PATH, "utf8");
    assert.ok(
      source.includes("requireAnySession"),
      "participants [pid] API must import any-session guard for read access"
    );
    assert.ok(
      source.includes("const handleGet") &&
        source.includes("requireAnySession(req, res)"),
      "GET handler must allow any authenticated participant/admin session"
    );
    assert.ok(
      source.includes("const handlePatch") &&
        source.includes("requireParticipantMatchOrAdmin(req, res, pid)"),
      "PATCH handler must keep stricter self-or-admin guard"
    );
  }
);
