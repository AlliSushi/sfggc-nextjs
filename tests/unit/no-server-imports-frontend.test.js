const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const walkFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath);
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      return [fullPath];
    }
    return [];
  });
};

test(
  "Given portal pages, when checking imports, then no server-only modules are referenced",
  () => {
    const portalDir = path.join(process.cwd(), "src/pages/portal");
    const files = walkFiles(portalDir);
    const forbidden = [
      "utils/portal/db",
      "utils/portal/admins-server",
      "pg",
    ];
    const errors = [];
    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      // Pages with getServerSideProps can import server modules —
      // Next.js tree-shakes them from the client bundle automatically.
      if (content.includes("getServerSideProps")) return;
      forbidden.forEach((needle) => {
        if (content.includes(needle)) {
          const relative = path.relative(process.cwd(), filePath);
          errors.push(`${relative} imports ${needle}`);
        }
      });
    });

    assert.equal(
      errors.length,
      0,
      `Server-only imports found in portal pages:\n${errors.join("\n")}`
    );
  }
);

test(
  "Given PortalShell wraps public pages, when checking its source, then the refresh ping does not use portalFetch",
  () => {
    const shellPath = path.join(
      process.cwd(),
      "src/components/Portal/PortalShell/PortalShell.js"
    );
    const content = fs.readFileSync(shellPath, "utf8");
    assert.ok(
      !content.includes("portalFetch"),
      "PortalShell must not import or use portalFetch — its refresh ping would redirect unauthenticated visitors (login, ack pages) on 401"
    );
  }
);

test(
  "Given a participant viewing their profile, when checking the page source, then the back link is inside an isAdmin guard",
  () => {
    const pidPagePath = path.join(
      process.cwd(),
      "src/pages/portal/participant/[pid].js"
    );
    const content = fs.readFileSync(pidPagePath, "utf8");
    const lines = content.split("\n");
    const dashboardLineIndex = lines.findIndex((line) => line.trim() === "Back");
    assert.ok(
      dashboardLineIndex > 0,
      "Back link should exist in [pid].js"
    );
    const preceding = lines
      .slice(Math.max(0, dashboardLineIndex - 3), dashboardLineIndex)
      .join("\n");
    assert.ok(
      preceding.includes("isAdmin"),
      "Back link must be inside an isAdmin guard — participants should not see it"
    );
  }
);

test(
  "Given a participant viewing a team page, when checking Team page source, then the back link is inside an isAdmin guard",
  () => {
    const teamPagePath = path.join(
      process.cwd(),
      "src/pages/portal/team/[teamSlug].js"
    );
    const content = fs.readFileSync(teamPagePath, "utf8");
    const lines = content.split("\n");
    const dashboardLineIndex = lines.findIndex((line) => line.trim() === "Back");
    assert.ok(
      dashboardLineIndex > 0,
      "Back link should exist in Team page"
    );
    const preceding = lines
      .slice(Math.max(0, dashboardLineIndex - 3), dashboardLineIndex)
      .join("\n");
    assert.ok(
      preceding.includes("isAdmin"),
      "Back link in Team page must be inside an isAdmin guard — participants should not see it"
    );
  }
);
