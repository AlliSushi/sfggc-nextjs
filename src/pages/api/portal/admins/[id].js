import { query } from "../../../../utils/portal/db.js";
import {
  ensureAdminTables,
  requireSuperAdmin,
} from "../../../../utils/portal/admins-server.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    methodNotAllowed(req, res, ["PATCH"]);
    return;
  }

  try {
    await ensureAdminTables();
    const payload = requireSuperAdmin(req, res);
    if (!payload) return;

    const { id } = req.query;
    const { role } = req.body || {};
    if (role !== "super-admin" && role !== "tournament-admin") {
      res.status(400).json({ error: "Invalid role." });
      return;
    }

    await query("update admins set role = ? where id = ?", [role, id]);
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
