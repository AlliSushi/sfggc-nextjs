import { query } from "../../../../../utils/portal/db.js";
import { methodNotAllowed } from "../../../../../utils/portal/http.js";
import { requireSuperAdmin } from "../../../../../utils/portal/auth-guards.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(req, res, ["POST"]);
    return;
  }

  try {
    const payload = requireSuperAdmin(req, res);
    if (!payload) return;

    await query("delete from audit_logs");
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
