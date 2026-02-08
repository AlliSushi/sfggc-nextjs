const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let portalFetch;
let originalFetch;
let assignedHref;
let mockPathname;

const setupLocationMock = (pathname) => {
  mockPathname = pathname;
  assignedHref = undefined;

  if (!globalThis.window) globalThis.window = {};
  Object.defineProperty(globalThis.window, "location", {
    configurable: true,
    get() {
      return {
        pathname: mockPathname,
        get href() {
          return `http://localhost:3000${mockPathname}`;
        },
        set href(value) {
          assignedHref = value;
        },
      };
    },
    set(value) {
      assignedHref = value?.href || value;
    },
  });
};

beforeEach(async () => {
  originalFetch = globalThis.fetch;
  setupLocationMock("/portal/admin/dashboard");

  const fullPath = path.join(
    process.cwd(),
    "src/utils/portal/portal-fetch.js"
  );
  const module = await import(pathToFileURL(fullPath) + `?t=${Date.now()}`);
  portalFetch = module.portalFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockFetch = (status, body = {}) => {
  globalThis.fetch = async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Map(),
  });
};

test(
  "Given a 200 response, when portalFetch is called, then the response is returned normally",
  async () => {
    mockFetch(200, { ok: true });

    const response = await portalFetch("/api/portal/admins");

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(assignedHref, undefined, "Should not redirect on 200");
  }
);

test(
  "Given a 401 response on an admin page, when portalFetch is called, then the user is redirected to admin login",
  async () => {
    setupLocationMock("/portal/admin/dashboard");
    mockFetch(401, { error: "Unauthorized" });

    const result = await Promise.race([
      portalFetch("/api/portal/admins").then(() => "resolved"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 50)),
    ]);

    assert.equal(result, "pending", "Should return a never-resolving promise");
    assert.equal(assignedHref, "/portal/", "Should redirect to admin login");
  }
);

test(
  "Given a 403 response on an admin page, when portalFetch is called, then the user is redirected to admin login",
  async () => {
    setupLocationMock("/portal/admin/audit");
    mockFetch(403, { error: "Forbidden" });

    const result = await Promise.race([
      portalFetch("/api/portal/admin/audit").then(() => "resolved"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 50)),
    ]);

    assert.equal(result, "pending");
    assert.equal(assignedHref, "/portal/", "Should redirect to admin login on 403");
  }
);

test(
  "Given a 401 response on a participant page, when portalFetch is called, then the user is redirected to participant login",
  async () => {
    setupLocationMock("/portal/participant/3336");
    mockFetch(401, { error: "Unauthorized" });

    const result = await Promise.race([
      portalFetch("/api/portal/participants/3336").then(() => "resolved"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 50)),
    ]);

    assert.equal(result, "pending");
    assert.equal(
      assignedHref,
      "/portal/participant",
      "Should redirect to participant login when on participant page"
    );
  }
);

test(
  "Given a 500 response, when portalFetch is called, then the response is returned normally",
  async () => {
    mockFetch(500, { error: "Internal server error" });

    const response = await portalFetch("/api/portal/admins");

    assert.equal(response.status, 500);
    assert.equal(assignedHref, undefined, "Should not redirect on 500");
  }
);
