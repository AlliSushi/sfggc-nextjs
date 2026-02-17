const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = process.cwd();

const ensureFileExists = (relativePath) => {
  const filePath = path.join(projectRoot, relativePath);
  assert.ok(fs.existsSync(filePath), `Missing ${relativePath}`);
};

test("Given the portal MVP, when checking routes, then key pages exist", () => {
  ensureFileExists("src/pages/portal/index.js");
  ensureFileExists("src/pages/portal/admin/index.js");
  ensureFileExists("src/pages/portal/admin/dashboard.js");
  ensureFileExists("src/pages/portal/admin/participants/[pid].js");
  ensureFileExists("src/pages/api/portal/participants/index.js");
  ensureFileExists("src/pages/portal/participant/index.js");
  ensureFileExists("src/pages/api/portal/participants/[pid].js");
  ensureFileExists("src/pages/api/portal/participants/[pid]/audit.js");
  ensureFileExists("src/pages/api/portal/admin/import-xml.js");
  ensureFileExists("src/pages/api/portal/admin/audit.js");
  ensureFileExists("src/pages/api/portal/admin/audit/clear.js");
  ensureFileExists("src/pages/portal/admin/admins/index.js");
  ensureFileExists("src/pages/portal/team/[teamSlug].js");
  ensureFileExists("src/pages/api/portal/teams/[teamSlug].js");
  ensureFileExists("src/pages/api/portal/admin/refresh.js");
  ensureFileExists("src/pages/portal/admin/audit.js");
  ensureFileExists("src/pages/api/portal/participant/login.js");
  ensureFileExists("src/pages/api/portal/participant/verify.js");
  ensureFileExists("src/pages/api/portal/participant/session.js");
  ensureFileExists("src/pages/api/portal/participant/logout.js");
  ensureFileExists("src/pages/portal/participant/verify.js");
  ensureFileExists("src/pages/api/portal/admin/logout.js");
  ensureFileExists("src/pages/api/portal/admins/index.js");
  ensureFileExists("src/pages/api/portal/admins/lookup.js");
  ensureFileExists("src/pages/api/portal/admins/[id]/index.js");
  ensureFileExists("src/pages/api/portal/admin/reset-password.js");
  ensureFileExists("src/pages/portal/admin/reset-password.js");
  ensureFileExists("src/pages/api/portal/admin/import-lanes.js");
  ensureFileExists("src/pages/portal/scores.js");
  ensureFileExists("src/pages/api/portal/scores.js");
  ensureFileExists("src/pages/api/portal/admin/scores/visibility.js");
  ensureFileExists("src/pages/portal/admin/scratch-masters.js");
  ensureFileExists("src/pages/api/portal/admin/scratch-masters.js");
  ensureFileExists("src/pages/api/portal/admin/scratch-masters/visibility.js");
  ensureFileExists("src/pages/portal/admin/optional-events.js");
  ensureFileExists("src/pages/api/portal/admin/optional-events.js");
  ensureFileExists("src/pages/api/portal/admin/optional-events/visibility.js");
  ensureFileExists("src/pages/api/portal/admin/optional-events/import.js");
});

// ---------------------------------------------------------------------------
// Auto-discovered import validation
// ---------------------------------------------------------------------------

/** Recursively find all .js files under a directory. */
const findJsFiles = (dir) => {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsFiles(fullPath));
    } else if (entry.name.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
};

/** Extract relative import paths from ES module import statements. */
const extractRelativeImports = (content) => {
  const importPattern = /from\s+["'](\.\.[^"']+)["']/g;
  const imports = [];
  let match;
  while ((match = importPattern.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
};

/**
 * Resolve an import path the way Next.js / Node does:
 * 1. Exact path (already has extension or is a file)
 * 2. Path + ".js"
 * 3. Path + "/index.js"
 */
const resolveImportPath = (absolutePath) => {
  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) return absolutePath;
  if (fs.existsSync(absolutePath + ".js")) return absolutePath + ".js";
  if (fs.existsSync(path.join(absolutePath, "index.js"))) return path.join(absolutePath, "index.js");
  return null;
};

const API_DIR = path.join(projectRoot, "src/pages/api/portal");
const PAGES_DIR = path.join(projectRoot, "src/pages/portal");
const allRouteFiles = [...findJsFiles(API_DIR), ...findJsFiles(PAGES_DIR)];

describe("Portal route import validation (auto-discovered)", () => {
  test("Given portal directories, when scanned, then at least 25 route files are found", () => {
    assert.ok(
      allRouteFiles.length >= 25,
      `Expected at least 25 portal route files, found ${allRouteFiles.length}`
    );
  });

  for (const filePath of allRouteFiles) {
    const relativePath = path.relative(projectRoot, filePath);

    test(`Given ${relativePath}, when checking imports, then all relative imports resolve to existing files`, () => {
      const content = fs.readFileSync(filePath, "utf-8");
      const relativeImports = extractRelativeImports(content);

      for (const importPath of relativeImports) {
        const absolutePath = path.resolve(path.dirname(filePath), importPath);
        const resolved = resolveImportPath(absolutePath);
        assert.ok(
          resolved,
          `${relativePath} imports "${importPath}" but ${path.relative(projectRoot, absolutePath)} does not exist ` +
            `(also tried .js and /index.js). Check the relative path depth (count of "../" segments).`
        );
      }
    });
  }
});
