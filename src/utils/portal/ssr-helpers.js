import { COOKIE_ADMIN, parseCookies, verifyToken } from "./session.js";

/**
 * Constructs the base URL from a Next.js SSR request object.
 *
 * Uses the x-forwarded-proto header when available (e.g. behind a reverse
 * proxy) and falls back to "http" for localhost or "https" otherwise.
 *
 * @param {import("http").IncomingMessage} req - Next.js request object
 * @returns {string} Base URL such as "https://example.com" or "http://localhost:3000"
 */
const buildBaseUrl = (req) => {
  const host = req.headers.host;
  const protocol =
    req.headers["x-forwarded-proto"] || (host?.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
};

const ADMIN_DASHBOARD_PATH = "/portal/admin/dashboard";

/**
 * Server-side guard that requires a super-admin session.
 *
 * Parses the admin cookie from the request, verifies the token, and
 * redirects to the admin dashboard when the caller is not a super-admin.
 *
 * @param {import("http").IncomingMessage} req - Next.js request object
 * @param {((payload: object) => object)} [extraPropsFromPayload] -
 *   Optional function that receives the verified token payload and returns
 *   additional props to merge into the page props.
 * @returns {{ props: object } | { redirect: object }}
 */
const requireSuperAdminSSR = (req, extraPropsFromPayload) => {
  try {
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies[COOKIE_ADMIN];
    const payload = verifyToken(token);
    if (!payload || payload.role !== "super-admin") {
      return {
        redirect: { destination: ADMIN_DASHBOARD_PATH, permanent: false },
      };
    }
    const extra = extraPropsFromPayload ? extraPropsFromPayload(payload) : {};
    return {
      props: { adminRole: payload.role || "", ...extra },
    };
  } catch (error) {
    return {
      redirect: { destination: ADMIN_DASHBOARD_PATH, permanent: false },
    };
  }
};

export { buildBaseUrl };
export { requireSuperAdminSSR, ADMIN_DASHBOARD_PATH };
