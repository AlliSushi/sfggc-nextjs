import { query } from "../../../../utils/portal/db.js";
import { requireAdmin } from "../../../../utils/portal/auth-guards.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      methodNotAllowed(req, res, ["GET"]);
      return;
    }

    const adminSession = requireAdmin(req, res);
    if (!adminSession) {
      return;
    }

    const search = (req.query.search || "").toLowerCase();
    let rows;

    if (search) {
      const result = await query(
        `
        select p.pid, p.first_name, p.last_name, p.email, t.team_name
        from people p
        left join teams t on p.tnmt_id = t.tnmt_id
        left join admins a on p.pid = a.pid
        where a.pid is null
          and (lower(p.pid) like ?
           or lower(p.email) like ?
           or lower(concat(p.first_name, ' ', p.last_name)) like ?)
        order by p.last_name, p.first_name
        `,
        [`%${search}%`, `%${search}%`, `%${search}%`]
      );
      rows = result.rows;
    } else {
      rows = (
        await query(
          `
          select p.pid, p.first_name, p.last_name, p.email, t.team_name
          from people p
          left join teams t on p.tnmt_id = t.tnmt_id
          left join admins a on p.pid = a.pid
          where a.pid is null
          order by p.last_name, p.first_name
          limit 200
          `
        )
      ).rows;
    }

    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
