import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// checkPartnerConflict — detects when target partner already has a different partner
// ---------------------------------------------------------------------------

describe("checkPartnerConflict", () => {
  it("Given partner B has no doubles_pairs row, when checking conflict for A setting partner to B, then returns null (no conflict)", async () => {
    const { checkPartnerConflict } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const mockQuery = async () => ({ rows: [] });

    const result = await checkPartnerConflict("B", "A", mockQuery);
    assert.equal(result, null, "No doubles_pairs row means no conflict");
  });

  it("Given partner B has doubles_pairs with partner_pid=null, when checking conflict for A, then returns null (no conflict)", async () => {
    const { checkPartnerConflict } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const mockQuery = async () => ({
      rows: [{
        partner_pid: null,
        first_name: "Bob",
        last_name: "Smith",
        current_partner_first: null,
        current_partner_last: null,
      }],
    });

    const result = await checkPartnerConflict("B", "A", mockQuery);
    assert.equal(result, null, "Null partner_pid means no conflict");
  });

  it("Given partner B has doubles_pairs with partner_pid=A (already reciprocal), when checking conflict for A, then returns null", async () => {
    const { checkPartnerConflict } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const mockQuery = async () => ({
      rows: [{
        partner_pid: "A",
        first_name: "Bob",
        last_name: "Smith",
        current_partner_first: "Alice",
        current_partner_last: "Jones",
      }],
    });

    const result = await checkPartnerConflict("B", "A", mockQuery);
    assert.equal(result, null, "Already reciprocal — no conflict");
  });

  it("Given partner B has doubles_pairs with partner_pid=C (different person), when checking conflict for A, then returns conflict object", async () => {
    const { checkPartnerConflict } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const mockQuery = async () => ({
      rows: [{
        partner_pid: "C",
        first_name: "Bob",
        last_name: "Smith",
        current_partner_first: "Charlie",
        current_partner_last: "Brown",
      }],
    });

    const result = await checkPartnerConflict("B", "A", mockQuery);
    assert.ok(result, "Should return a conflict object");
    assert.equal(result.partnerPid, "B");
    assert.equal(result.partnerName, "Bob Smith");
    assert.equal(result.currentPartnerPid, "C");
    assert.equal(result.currentPartnerName, "Charlie Brown");
  });
});

// ---------------------------------------------------------------------------
// upsertReciprocalPartner — creates reciprocal link in partner's doubles_pairs
// ---------------------------------------------------------------------------

describe("upsertReciprocalPartner", () => {
  it("Given partner B has a did value, when upsertReciprocalPartner is called, then B's doubles_pairs row is upserted with partner_pid=A", async () => {
    const { upsertReciprocalPartner } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const calls = [];
    const mockQuery = async (sql, params) => {
      calls.push({ sql: sql.trim(), params });
      // First call: look up partner's did
      if (sql.includes("SELECT") && sql.includes("did") && sql.includes("people")) {
        return { rows: [{ did: "D200" }] };
      }
      // Second call: check partner's current partner_pid
      if (sql.includes("SELECT") && sql.includes("partner_pid") && sql.includes("doubles_pairs")) {
        return { rows: [{ partner_pid: null }] };
      }
      return { rows: [] };
    };

    await upsertReciprocalPartner("B", "A", mockQuery);

    // Should have an INSERT/UPSERT for doubles_pairs with did=D200, pid=B, partner_pid=A
    const upsertCall = calls.find(
      (c) =>
        c.sql.toLowerCase().includes("insert into doubles_pairs") &&
        c.params?.includes("D200") &&
        c.params?.includes("B") &&
        c.params?.includes("A")
    );
    assert.ok(
      upsertCall,
      "Must upsert doubles_pairs with did=D200, pid=B, partner_pid=A"
    );
  });

  it("Given partner B has no did value (null), when upsertReciprocalPartner is called, then no doubles_pairs row is created", async () => {
    const { upsertReciprocalPartner } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const calls = [];
    const mockQuery = async (sql, params) => {
      calls.push({ sql: sql.trim(), params });
      // Partner has no did
      if (sql.includes("SELECT") && sql.includes("did") && sql.includes("people")) {
        return { rows: [{ did: null }] };
      }
      return { rows: [] };
    };

    await upsertReciprocalPartner("B", "A", mockQuery);

    // Should NOT have any INSERT into doubles_pairs
    const upsertCall = calls.find((c) =>
      c.sql.toLowerCase().includes("insert into doubles_pairs")
    );
    assert.equal(
      upsertCall,
      undefined,
      "Must not insert doubles_pairs when partner has no did"
    );
  });

  it("Given partner B was pointing to C, when upsertReciprocalPartner replaces with A, then C's partner_pid is cleared", async () => {
    const { upsertReciprocalPartner } = await import(
      "../../src/utils/portal/participant-db.js"
    );

    const calls = [];
    const mockQuery = async (sql, params) => {
      calls.push({ sql: sql.trim(), params });
      if (sql.includes("SELECT") && sql.includes("did") && sql.includes("people")) {
        return { rows: [{ did: "D200" }] };
      }
      if (sql.includes("SELECT") && sql.includes("partner_pid") && sql.includes("doubles_pairs")) {
        return { rows: [{ partner_pid: "C" }] };
      }
      return { rows: [] };
    };

    await upsertReciprocalPartner("B", "A", mockQuery);

    // Should clear C's partner_pid reference to B
    const clearCall = calls.find(
      (c) =>
        c.sql.toLowerCase().includes("update doubles_pairs") &&
        c.sql.toLowerCase().includes("partner_pid = null") &&
        c.params?.includes("C") &&
        c.params?.includes("B")
    );
    assert.ok(
      clearCall,
      "Must clear C's partner_pid reference to B when replacing"
    );
  });
});

// ---------------------------------------------------------------------------
// handlePatch reciprocal flow — API route behavior
// ---------------------------------------------------------------------------

describe("handlePatch reciprocal flow", () => {
  it("Given partner_pid changed and partner has no conflict, when handlePatch source is checked, then it calls upsertReciprocalPartner", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const apiSrc = fs.readFileSync(
      path.join(__dirname, "../../src/pages/api/portal/participants/[pid].js"),
      "utf-8"
    );

    assert.ok(
      apiSrc.includes("checkPartnerConflict"),
      "handlePatch must call checkPartnerConflict to detect conflicts"
    );
    assert.ok(
      apiSrc.includes("upsertReciprocalPartner"),
      "handlePatch must call upsertReciprocalPartner for reciprocal updates"
    );
  });

  it("Given partner has existing different partner, when PATCH sent without forceReciprocal, then API returns 409 with conflict object", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const apiSrc = fs.readFileSync(
      path.join(__dirname, "../../src/pages/api/portal/participants/[pid].js"),
      "utf-8"
    );

    assert.ok(
      apiSrc.includes("409"),
      "handlePatch must return 409 status on partner conflict"
    );
    assert.ok(
      apiSrc.includes("forceReciprocal"),
      "handlePatch must check for forceReciprocal flag to bypass conflict"
    );
  });

  it("Given reciprocal update occurs, when checking handlePatch source, then audit entries are written for the partner's PID", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const apiSrc = fs.readFileSync(
      path.join(__dirname, "../../src/pages/api/portal/participants/[pid].js"),
      "utf-8"
    );

    // The API must call writeAuditEntries for the partner (separate from the main participant)
    // Count occurrences of writeAuditEntries — should appear at least twice
    const matches = apiSrc.match(/writeAuditEntries/g) || [];
    assert.ok(
      matches.length >= 2,
      `writeAuditEntries must be called at least twice (once for participant, once for partner). Found ${matches.length} occurrences.`
    );
  });
});

// ---------------------------------------------------------------------------
// Frontend — handles 409 and shows confirmation dialog
// ---------------------------------------------------------------------------

describe("frontend reciprocal partner dialog", () => {
  it("Given handleSave in participant page, when response is 409, then it shows partner conflict dialog", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pageSrc = fs.readFileSync(
      path.join(__dirname, "../../src/pages/portal/participant/[pid].js"),
      "utf-8"
    );

    assert.ok(
      pageSrc.includes("409"),
      "handleSave must check for 409 status to detect partner conflicts"
    );
    assert.ok(
      pageSrc.includes("partnerConflict"),
      "Page must have partnerConflict state for dialog"
    );
  });

  it("Given partner conflict dialog, when user clicks Replace, then PATCH is re-sent with forceReciprocal flag", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pageSrc = fs.readFileSync(
      path.join(__dirname, "../../src/pages/portal/participant/[pid].js"),
      "utf-8"
    );

    assert.ok(
      pageSrc.includes("forceReciprocal"),
      "Page must send forceReciprocal flag when user confirms replacement"
    );
  });

  it("Given partner conflict exists, when rendering, then PortalModal is shown with conflict details", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pageSrc = fs.readFileSync(
      path.join(__dirname, "../../src/pages/portal/participant/[pid].js"),
      "utf-8"
    );

    assert.ok(
      pageSrc.includes("Replace existing doubles partner") ||
      pageSrc.includes("Replace partner") ||
      pageSrc.includes("partnerConflict"),
      "Page must render a confirmation dialog for partner conflicts"
    );
    assert.ok(
      pageSrc.includes("PortalModal"),
      "Page must use PortalModal for the confirmation dialog"
    );
  });
});
