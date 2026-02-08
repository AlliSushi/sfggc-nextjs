import { query } from "../../../../utils/portal/db.js";
import { ensureAdminTables } from "../../../../utils/portal/admins-server.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import { requireSuperAdmin } from "../../../../utils/portal/auth-guards.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(req, res, ["GET"]);
    return;
  }

  try {
    await ensureAdminTables();
    const payload = requireSuperAdmin(req, res);
    if (!payload) return;

    const queryValue = (req.query?.q || "").trim();
    if (!queryValue) {
      res.status(200).json({ admin: null, participant: null });
      return;
    }

    const adminResult = await query(
      `
      select id, email, first_name, last_name, phone, role
      from admins
      where lower(email) = lower(?)
         or phone = ?
      limit 1
      `,
      [queryValue, queryValue]
    );
    if (adminResult.rows.length) {
      res.status(200).json({ admin: adminResult.rows[0], participant: null });
      return;
    }

    const participantResult = await query(
      `
      select pid, first_name, last_name, email, phone
      from people
      where lower(email) = lower(?)
         or phone = ?
      limit 1
      `,
      [queryValue, queryValue]
    );
    res.status(200).json({ admin: null, participant: participantResult.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
