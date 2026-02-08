import { getAdminSession } from "../../../../utils/portal/session.js";
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
    res.status(200).json({ ok: true, admin: payload });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
