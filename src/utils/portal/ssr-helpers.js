import { COOKIE_ADMIN, parseCookies, verifyToken } from "./session.js";

/**
 * Returns the base URL for internal SSR API fetches.
 *
 * Always uses http://localhost to call the local Node.js server directly.
 * This avoids a self-referencing loop through nginx (browser → nginx →
 * Node.js SSR → nginx HTTPS → Node.js API) which fails when the server
 * cannot connect to its own public HTTPS endpoint.
 *
 * @returns {string} Internal base URL like "http://localhost:3000"
 */
const buildBaseUrl = () => {
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
};

const ADMIN_DASHBOARD_PATH = "/portal/admin/dashboard";
const ADMIN_LOGIN_PATH = "/portal/admin/";

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

/**
 * Server-side guard that requires any valid admin session.
 *
 * @param {import("http").IncomingMessage} req - Next.js request object
 * @param {((payload: object) => object)} [extraPropsFromPayload] -
 *   Optional function that receives the verified token payload and returns
 *   additional props to merge into the page props.
 * @returns {{ props: object } | { redirect: object }}
 */
const requireAdminSSR = (req, extraPropsFromPayload) => {
  try {
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies[COOKIE_ADMIN];
    const payload = verifyToken(token);
    if (!payload) {
      return {
        redirect: { destination: ADMIN_LOGIN_PATH, permanent: false },
      };
    }
    const extra = extraPropsFromPayload ? extraPropsFromPayload(payload) : {};
    return {
      props: { adminRole: payload.role || "", ...extra },
    };
  } catch (error) {
    return {
      redirect: { destination: ADMIN_LOGIN_PATH, permanent: false },
    };
  }
};

export { buildBaseUrl };
export { requireSuperAdminSSR, requireAdminSSR, ADMIN_DASHBOARD_PATH };
