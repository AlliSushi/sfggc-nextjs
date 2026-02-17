import { query } from "../../../../../utils/portal/db.js";
import { requireParticipantMatchOrAdmin } from "../../../../../utils/portal/auth-guards.js";
import { methodNotAllowed } from "../../../../../utils/portal/http.js";
import { ensureAdminActionsTables } from "../../../../../utils/portal/admins-server.js";

const PARTICIPANT_AUDIT_LIMIT = 20;

export default async function handler(req, res) {
  const { pid } = req.query;

  try {
    if (req.method !== "GET") {
      methodNotAllowed(req, res, ["GET"]);
      return;
    }

    const sessions = await requireParticipantMatchOrAdmin(req, res, pid);
    if (!sessions) {
      return;
    }

    await ensureAdminActionsTables();

    const { rows } = await query(
      `
      select
        a.id,
        a.admin_email,
        a.pid,
        a.field,
        a.old_value,
        a.new_value,
        a.changed_at
      from audit_logs a
      where a.pid = ?
      union all
      select
        ev.id,
        ev.admin_email,
        cast(null as char) as pid,
        ev.action as field,
        cast(null as char) as old_value,
        cast(null as char) as new_value,
        ev.created_at as changed_at
      from admin_actions ev
      where ev.action = 'clear_audit_log'
      order by changed_at desc
      limit ?
      `,
      [pid, PARTICIPANT_AUDIT_LIMIT]
    );
    res.status(200).json(rows || []);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Unexpected error.",
    });
  }
}
