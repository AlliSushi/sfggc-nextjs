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

test("Participant page SSR redirects on unauthorized API response", async () => {
  const { buildParticipantPageProps } = await loadModule(
    "src/utils/portal/participant-page-ssr.js"
  );
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

  const result = await buildParticipantPageProps({
    params: { pid: "586" },
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

test("Participant page SSR returns notFound on missing participant", async () => {
  const { buildParticipantPageProps } = await loadModule(
    "src/utils/portal/participant-page-ssr.js"
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

  const result = await buildParticipantPageProps({
    params: { pid: "999" },
    req,
    fetcher,
  });

  assert.deepEqual(result, { notFound: true });
});
