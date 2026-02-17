import { COOKIE_ADMIN, buildCookieString } from "../../../../utils/portal/session.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(req, res, ["POST"]);
    return;
  }

  res.setHeader("Set-Cookie", buildCookieString(COOKIE_ADMIN, "", 0));
  res.status(200).json({ ok: true });
}
