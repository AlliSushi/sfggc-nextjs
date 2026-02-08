import { query } from "../../../../utils/portal/db.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import { requireSuperAdmin } from "../../../../utils/portal/auth-guards.js";

const AUDIT_RESULTS_LIMIT = 500;

const buildSearch = (value) => `%${value}%`;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(req, res, ["GET"]);
    return;
  }

  try {
    const payload = requireSuperAdmin(req, res);
    if (!payload) return;

    await query(
      `
      create table if not exists admin_actions (
        id char(36) primary key default (uuid()),
        admin_email text not null,
        action text not null,
        details text,
        created_at timestamp default current_timestamp
      )
      `
    );

    const q = (req.query?.q || "").trim();
    const sort = (req.query?.sort || "desc").toLowerCase();
    const orderDirection = sort === "asc" ? "asc" : "desc";
    const params = [];
    const where = [];

    if (q) {
      const value = buildSearch(q);
      params.push(value, value, value, value);
      where.push(
        `(lower(a.admin_email) like lower(?)
          or lower(p.first_name) like lower(?)
          or lower(p.last_name) like lower(?)
          or lower(t.team_name) like lower(?))`
      );
    }

    const whereClause = where.length ? `where ${where.join(" and ")}` : "";
    const actionWhere = whereClause
      ? `where (lower(ev.admin_email) like lower(?) or lower(ev.action) like lower(?) or lower(ev.details) like lower(?))`
      : "";
    if (q) {
      const value = buildSearch(q);
      params.push(value, value, value);
    }
    const { rows } = await query(
      `
      select
        a.id,
        a.admin_email,
        a.pid,
        a.field,
        a.old_value,
        a.new_value,
        a.changed_at,
        p.first_name,
        p.last_name,
        t.team_name
      from audit_logs a
      left join people p on p.pid = a.pid
      left join teams t on t.tnmt_id = p.tnmt_id
      ${whereClause}
      union all
      select
        ev.id,
        ev.admin_email,
        cast(null as char) as pid,
        ev.action as field,
        cast(null as char) as old_value,
        cast(null as char) as new_value,
        ev.created_at as changed_at,
        cast(null as char) as first_name,
        cast(null as char) as last_name,
        cast(null as char) as team_name
      from admin_actions ev
      ${actionWhere}
      order by changed_at ${orderDirection}
      limit ${AUDIT_RESULTS_LIMIT}
      `,
      params
    );

    res.status(200).json(rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
