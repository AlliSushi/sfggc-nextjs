import { query } from "../../../../../utils/portal/db.js";
import { requireParticipantMatchOrAdmin } from "../../../../../utils/portal/auth-guards.js";
import { methodNotAllowed } from "../../../../../utils/portal/http.js";

export default async function handler(req, res) {
  const { pid } = req.query;

  try {
    if (req.method !== "GET") {
      methodNotAllowed(req, res, ["GET"]);
      return;
    }

    const sessions = requireParticipantMatchOrAdmin(req, res, pid);
    if (!sessions) {
      return;
    }

    const { rows } = await query(
      "select * from audit_logs where pid = ? order by changed_at desc limit 20",
      [pid]
    );
    res.status(200).json(rows || []);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Unexpected error.",
    });
  }
}
