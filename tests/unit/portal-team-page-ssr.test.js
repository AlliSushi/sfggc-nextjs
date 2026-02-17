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

test("Team page SSR redirects on unauthorized API response", async () => {
  const { buildTeamPageProps } = await loadModule("src/utils/portal/team-page-ssr.js");
  const { buildSessionToken, COOKIE_PARTICIPANT, PARTICIPANT_SESSION_TTL_MS } =
    await loadModule("src/utils/portal/session.js");

  const token = buildSessionToken(
    { role: "participant", pid: "586" },
    PARTICIPANT_SESSION_TTL_MS
  );
  const req = {
    headers: {
      host: "localhost:3000",
      cookie: `${COOKIE_PARTICIPANT}=${token}`,
    },
  };

  let capturedOptions = null;
  const fetcher = async (url, options) => {
    capturedOptions = options;
    return {
      ok: false,
      status: 401,
    };
  };

  const result = await buildTeamPageProps({
    params: { teamSlug: "well-no-split" },
    req,
    fetcher,
  });

  assert.deepEqual(result, {
    redirect: {
      destination: "/portal/participant",
      permanent: false,
    },
  });
  assert.equal(capturedOptions?.headers?.cookie, req.headers.cookie);
});

test("Team page SSR returns notFound on missing team", async () => {
  const { buildTeamPageProps } = await loadModule("src/utils/portal/team-page-ssr.js");
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

  const result = await buildTeamPageProps({
    params: { teamSlug: "missing-team" },
    req,
    fetcher,
  });

  assert.deepEqual(result, { notFound: true });
});
