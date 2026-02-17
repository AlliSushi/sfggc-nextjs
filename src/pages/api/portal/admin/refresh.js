import {
  ADMIN_SESSION_TTL_MS,
  COOKIE_ADMIN,
  buildSessionToken,
  buildCookieString,
  getAdminSession,
} from "../../../../utils/portal/session.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(req, res, ["GET"]);
    return;
  }

  try {
    const payload = getAdminSession(req.headers.cookie || "");
    if (!payload) {
      res.status(401).json({ ok: false });
      return;
    }

    const refreshed = buildSessionToken(
      { email: payload.email, role: payload.role },
      ADMIN_SESSION_TTL_MS
    );
    const maxAgeSeconds = Math.floor(ADMIN_SESSION_TTL_MS / 1000);
    res.setHeader(
      "Set-Cookie",
      buildCookieString(COOKIE_ADMIN, refreshed, maxAgeSeconds)
    );
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
