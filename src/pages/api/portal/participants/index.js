import { query } from "../../../../utils/portal/db.js";
import { requireAdmin } from "../../../../utils/portal/auth-guards.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import { EVENT_TYPES } from "../../../../utils/portal/event-constants.js";

/**
 * Build SQL query for fetching participants list with scores.
 * Extracts book average and handicap from scores table, prioritizing team, then doubles, then singles.
 *
 * @param {string|null} search - Optional search term for filtering by PID, email, or name
 * @returns {object} Query object with sql string and params array
 */
const buildParticipantsQuery = (search = null) => {
  const baseQuery = `
    select p.pid, p.first_name, p.last_name, p.nickname, p.email, t.team_name,
      coalesce(st.entering_avg, sd.entering_avg, ss.entering_avg) as book_average,
      coalesce(st.handicap, sd.handicap, ss.handicap) as handicap
    from people p
    left join teams t on p.tnmt_id = t.tnmt_id
    left join admins a on p.pid = a.pid
    left join scores st on st.pid = p.pid and st.event_type = ?
    left join scores sd on sd.pid = p.pid and sd.event_type = ?
    left join scores ss on ss.pid = p.pid and ss.event_type = ?
    where a.pid is null`;

  const eventTypeParams = [
    EVENT_TYPES.TEAM, EVENT_TYPES.DOUBLES, EVENT_TYPES.SINGLES,
  ];

  if (search) {
    const searchPattern = `%${search}%`;
    return {
      sql: `${baseQuery}
        and (lower(p.pid) like ?
         or lower(p.email) like ?
         or lower(concat(p.first_name, ' ', p.last_name)) like ?)
      order by p.last_name, p.first_name`,
      params: [...eventTypeParams, searchPattern, searchPattern, searchPattern],
    };
  }

  return {
    sql: `${baseQuery}
    order by p.last_name, p.first_name
    limit 200`,
    params: eventTypeParams,
  };
};

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      methodNotAllowed(req, res, ["GET"]);
      return;
    }

    const adminSession = await requireAdmin(req, res);
    if (!adminSession) {
      return;
    }

    const search = (req.query.search || "").toLowerCase();
    const { sql, params } = buildParticipantsQuery(search || null);
    const result = await query(sql, params);

    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
