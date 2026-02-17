import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendFromParam,
  resolveBackHref,
  normalizeQueryValue,
  resolveLaneEntryHref,
} from "../../src/utils/portal/navigation.js";
import { toTeamSlug } from "../../src/utils/portal/slug.js";
import { EM_DASH } from "../../src/utils/portal/display-constants.js";
import { resolveInitialEvent, EVENT_TYPES } from "../../src/utils/portal/event-constants.js";

describe("portal navigation helpers", () => {
  it("Given a safe internal from path, when resolving back href, then it returns the from path", () => {
    const result = resolveBackHref("/portal/team/tlstrong?from=%2Fportal%2Fadmin%2Flane-assignments", "/portal/admin/dashboard");
    assert.equal(result, "/portal/team/tlstrong?from=%2Fportal%2Fadmin%2Flane-assignments");
  });

  it("Given an unsafe external from URL, when resolving back href, then it falls back", () => {
    const result = resolveBackHref("https://evil.example.com/phish", "/portal/admin/dashboard");
    assert.equal(result, "/portal/admin/dashboard");
  });

  it("Given an internal href and return path, when appending from, then URL contains encoded from param", () => {
    const result = appendFromParam("/portal/participant/P123", "/portal/team/tlstrong?from=%2Fportal%2Fadmin%2Flane-assignments");
    assert.equal(
      result,
      "/portal/participant/P123?from=%2Fportal%2Fteam%2Ftlstrong%3Ffrom%3D%252Fportal%252Fadmin%252Flane-assignments"
    );
  });

  it("Given a query array value, when normalizing query value, then first element is used", () => {
    assert.equal(normalizeQueryValue(["/portal/admin/lane-assignments", "/portal/admin/dashboard"]), "/portal/admin/lane-assignments");
  });

  it("Given a team label, when slugging for lane assignment links, then slug is derived", () => {
    assert.equal(toTeamSlug("TL Strong"), "tl-strong");
  });

  it("Given a participant entry with pid and label, when resolving lane assignment destination, then participant route takes precedence", () => {
    const destination = resolveLaneEntryHref(
      { pid: "P100", label: "Split Happens", teamSlug: "split-happens" },
      "/portal/admin/lane-assignments"
    );
    assert.equal(destination, "/portal/participant/P100?from=%2Fportal%2Fadmin%2Flane-assignments");
  });

  it("Given a team entry without pid, when resolving lane assignment destination, then it links to the team page", () => {
    const destination = resolveLaneEntryHref(
      { label: "Pin Pals", teamSlug: "pin-pals" },
      "/portal/admin/lane-assignments"
    );
    assert.equal(destination, "/portal/team/pin-pals?from=%2Fportal%2Fadmin%2Flane-assignments");
  });

  it("Given a placeholder lane entry, when resolving lane assignment destination, then it returns an empty href", () => {
    const destination = resolveLaneEntryHref({ label: EM_DASH }, "/portal/admin/lane-assignments");
    assert.equal(destination, "");
  });

  // Score standings navigation flow
  it("Given a team page path, when building View Standings URL, then scores URL includes from param", () => {
    const result = appendFromParam("/portal/scores", "/portal/team/tl-strong");
    assert.equal(result, "/portal/scores?from=%2Fportal%2Fteam%2Ftl-strong");
  });

  it("Given a participant page path, when building View Standings URL, then scores URL includes from param", () => {
    const result = appendFromParam("/portal/scores", "/portal/participant/P123");
    assert.equal(result, "/portal/scores?from=%2Fportal%2Fparticipant%2FP123");
  });

  it("Given a team page from param on scores page, when resolving back href, then returns team page", () => {
    const result = resolveBackHref("/portal/team/tl-strong", "/portal/");
    assert.equal(result, "/portal/team/tl-strong");
  });

  it("Given no from param on scores page, when resolving back href with portal fallback, then returns portal home", () => {
    const result = resolveBackHref("", "/portal/");
    assert.equal(result, "/portal/");
  });

  it("Given undefined from param on scores page, when resolving back href, then returns portal fallback", () => {
    const result = resolveBackHref(undefined, "/portal/");
    assert.equal(result, "/portal/");
  });
});

describe("resolveInitialEvent", () => {
  it("Given 'team' query param, when resolving initial event, then returns EVENT_TYPES.TEAM", () => {
    assert.equal(resolveInitialEvent("team"), EVENT_TYPES.TEAM);
  });

  it("Given 'doubles' query param, when resolving initial event, then returns EVENT_TYPES.DOUBLES", () => {
    assert.equal(resolveInitialEvent("doubles"), EVENT_TYPES.DOUBLES);
  });

  it("Given 'singles' query param, when resolving initial event, then returns EVENT_TYPES.SINGLES", () => {
    assert.equal(resolveInitialEvent("singles"), EVENT_TYPES.SINGLES);
  });

  it("Given invalid query param, when resolving initial event, then returns EVENT_TYPES.TEAM as default", () => {
    assert.equal(resolveInitialEvent("invalid"), EVENT_TYPES.TEAM);
  });

  it("Given undefined query param, when resolving initial event, then returns EVENT_TYPES.TEAM as default", () => {
    assert.equal(resolveInitialEvent(undefined), EVENT_TYPES.TEAM);
  });

  it("Given null query param, when resolving initial event, then returns EVENT_TYPES.TEAM as default", () => {
    assert.equal(resolveInitialEvent(null), EVENT_TYPES.TEAM);
  });
});
