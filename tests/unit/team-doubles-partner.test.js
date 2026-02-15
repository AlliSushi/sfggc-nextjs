import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEAM_API_PATH = path.join(
  __dirname,
  "../../src/pages/api/portal/teams/[teamSlug].js"
);
const teamSrc = fs.readFileSync(TEAM_API_PATH, "utf-8");

// ---------------------------------------------------------------------------
// fetchTeamMembers — doubles_pairs JOIN must use did, not pid
// ---------------------------------------------------------------------------

describe("fetchTeamMembers doubles_pairs JOIN", () => {
  it("Given fetchTeamMembers SQL, when joining doubles_pairs, then it joins on did (not pid) to avoid stale rows", () => {
    // The JOIN must be on p.did = d.did, NOT d.pid = p.pid
    // Joining on pid returns stale doubles_pairs entries when participant changed partners.
    assert.ok(
      teamSrc.includes("d on d.did = p.did") || teamSrc.includes("d on p.did = d.did"),
      "fetchTeamMembers doubles_pairs JOIN must use did (d.did = p.did or p.did = d.did) to avoid stale rows"
    );
    assert.ok(
      !teamSrc.includes("d on d.pid = p.pid"),
      "fetchTeamMembers doubles_pairs JOIN must NOT use d.pid = p.pid (returns stale rows)"
    );
  });
});

// ---------------------------------------------------------------------------
// resolveRosterPartner — must respect cleared partner_pid (did fallback)
// ---------------------------------------------------------------------------

describe("resolvePartner cleared partner_pid", () => {
  it("Given a team member with partner_pid explicitly null (cleared), when resolvePartner runs, then the did-sharing fallback must not find a partner", () => {
    // When partner_pid is null (cleared by admin), the shared-did and name-matching
    // fallbacks should NOT override the cleared partner. resolveRosterPartner must check
    // for doubles_did to detect an existing doubles_pairs entry and return early.
    const resolvePartnerSource = teamSrc.match(
      /const resolveRosterPartner[\s\S]*?return null;\s*\};/
    )?.[0] || "";

    assert.ok(
      resolvePartnerSource.length > 0,
      "resolveRosterPartner function must exist in team API"
    );

    // The function must guard against cleared partner_pid by checking doubles_did.
    // When doubles_did is set, a doubles_pairs entry exists and its partner_pid
    // is authoritative — even when null.
    assert.ok(
      resolvePartnerSource.includes("doubles_did"),
      "resolveRosterPartner must check doubles_did to detect an existing doubles_pairs entry and skip fallbacks when partner was cleared"
    );
  });

  it("Given fetchTeamMembers SQL, when selecting doubles_pairs fields, then it includes d.did as doubles_did for cleared-partner detection", () => {
    // resolveRosterPartner needs doubles_did to distinguish "no doubles_pairs row"
    // (partner_pid null from LEFT JOIN) from "doubles_pairs row with cleared partner_pid".
    assert.ok(
      teamSrc.includes("d.did as doubles_did"),
      "fetchTeamMembers must select d.did as doubles_did so resolvePartner can detect cleared partners"
    );
  });
});
