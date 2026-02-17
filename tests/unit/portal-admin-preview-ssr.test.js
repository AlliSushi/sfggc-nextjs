const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

if (!process.env.ADMIN_SESSION_SECRET) {
  process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";
}

const loadModule = async (relativePath) => {
  const fullPath = path.join(process.cwd(), relativePath);
  return import(pathToFileURL(fullPath));
};

test("Admin preview SSR redirects when no admin session", async () => {
  const { buildAdminPreviewPageProps } = await loadModule(
    "src/utils/portal/admin-preview-page-ssr.js"
  );

  const req = {
    headers: {
      host: "localhost:3000",
      cookie: "",
    },
  };

  const result = await buildAdminPreviewPageProps({
    params: { pid: "123" },
    req,
  });

  assert.deepEqual(result, {
    redirect: {
      destination: "/portal/admin",
      permanent: false,
    },
  });
});

test("Admin preview SSR redirects on unauthorized API response", async () => {
  const { buildAdminPreviewPageProps } = await loadModule(
    "src/utils/portal/admin-preview-page-ssr.js"
  );
  const { buildSessionToken, COOKIE_ADMIN, ADMIN_SESSION_TTL_MS } = await loadModule(
    "src/utils/portal/session.js"
  );

  const token = buildSessionToken(
    { role: "super-admin", email: "admin@example.com" },
    ADMIN_SESSION_TTL_MS
  );
  const req = {
    headers: {
      host: "localhost:3000",
      cookie: `${COOKIE_ADMIN}=${token}`,
    },
  };

  let capturedOptions = null;
  const fetcher = async (url, options) => {
    capturedOptions = options;
    return {
      ok: false,
      status: 403,
    };
  };

  const result = await buildAdminPreviewPageProps({
    params: { pid: "123" },
    req,
    fetcher,
  });

  assert.deepEqual(result, {
    redirect: {
      destination: "/portal/admin",
      permanent: false,
    },
  });
  assert.equal(capturedOptions?.headers?.cookie, req.headers.cookie);
});

test("Admin preview SSR returns notFound on missing participant", async () => {
  const { buildAdminPreviewPageProps } = await loadModule(
    "src/utils/portal/admin-preview-page-ssr.js"
  );
  const { buildSessionToken, COOKIE_ADMIN, ADMIN_SESSION_TTL_MS } = await loadModule(
    "src/utils/portal/session.js"
  );

  const token = buildSessionToken(
    { role: "super-admin", email: "admin@example.com" },
    ADMIN_SESSION_TTL_MS
  );
  const req = {
    headers: {
      host: "localhost:3000",
      cookie: `${COOKIE_ADMIN}=${token}`,
    },
  };

  const fetcher = async () => ({
    ok: false,
    status: 404,
  });

  const result = await buildAdminPreviewPageProps({
    params: { pid: "404" },
    req,
    fetcher,
  });

  assert.deepEqual(result, { notFound: true });
});
