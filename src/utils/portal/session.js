import crypto from "crypto";

const generateSecureToken = () => crypto.randomBytes(24).toString("hex");

const getSecret = () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set.");
  }
  return secret;
};

const base64UrlEncode = (value) =>
  Buffer.from(value).toString("base64url");

const base64UrlDecode = (value) =>
  Buffer.from(value, "base64url").toString("utf8");

const signPayload = (payload) => {
  const secret = getSecret();
  const data = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
};

const verifyToken = (token) => {
  if (!token || !token.includes(".")) {
    return null;
  }
  try {
    const [data, signature] = token.split(".");
    const secret = getSecret();
    const expected = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64url");
    if (expected !== signature) {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(data));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
};

const buildSessionToken = ({ email, role, pid }, ttlMs = 24 * 60 * 60 * 1000) => {
  const payload = {
    email,
    role,
    pid,
    exp: Date.now() + ttlMs,
  };
  return signPayload(payload);
};

const ADMIN_SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const PARTICIPANT_SESSION_TTL_MS = 48 * 60 * 60 * 1000;
const PARTICIPANT_LINK_TTL_MS = 30 * 60 * 1000;
const ADMIN_PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

const COOKIE_ADMIN = "portal_admin";
const COOKIE_PARTICIPANT = "portal_participant";
const COOKIE_ADMIN_RESET = "portal_admin_reset";

const ADMIN_ROLES = ["super-admin", "tournament-admin"];

const parseCookies = (cookieHeader = "") => {
  return cookieHeader.split(";").reduce((acc, pair) => {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = rest.join("=");
    return acc;
  }, {});
};

const getAdminSession = (cookieHeader = "") => {
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_ADMIN];
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }
  const allowedRoles = new Set(ADMIN_ROLES);
  if (!allowedRoles.has(payload.role)) {
    return null;
  }
  return payload;
};

const getParticipantSession = (cookieHeader = "") => {
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_PARTICIPANT];
  const payload = verifyToken(token);
  if (!payload || payload.role !== "participant" || !payload.pid) {
    return null;
  }
  return payload;
};

const isProduction = () => process.env.NODE_ENV === "production";

const buildCookieString = (name, value, maxAgeSeconds) => {
  const parts = [
    `${name}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProduction()) {
    parts.push("Secure");
  }
  return parts.join("; ");
};

const buildExpiredCookie = (cookieName) => buildCookieString(cookieName, "", 0);

export {
  buildSessionToken,
  verifyToken,
  parseCookies,
  getAdminSession,
  getParticipantSession,
  buildCookieString,
  buildExpiredCookie,
  generateSecureToken,
  COOKIE_ADMIN,
  COOKIE_PARTICIPANT,
  COOKIE_ADMIN_RESET,
  ADMIN_ROLES,
  ADMIN_SESSION_TTL_MS,
  PARTICIPANT_SESSION_TTL_MS,
  PARTICIPANT_LINK_TTL_MS,
  ADMIN_PASSWORD_RESET_TTL_MS,
};
