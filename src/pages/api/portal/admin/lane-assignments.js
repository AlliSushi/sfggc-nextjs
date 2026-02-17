import { query } from "../../../../utils/portal/db.js";
import { requireAdmin } from "../../../../utils/portal/auth-guards.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import { EVENT_TYPES } from "../../../../utils/portal/event-constants.js";
import { buildLaneAssignments } from "../../../../utils/portal/lane-assignments.js";

const LANE_FILTER_SQL = `
  and s.lane is not null
  and trim(s.lane) <> ''
`;

const fetchTeamRows = async () => {
  const { rows } = await query(
    `
    select s.lane, t.team_name, t.slug as team_slug
    from scores s
    inner join people p on p.pid = s.pid
    left join teams t on t.tnmt_id = p.tnmt_id
    where s.event_type = ?
      ${LANE_FILTER_SQL}
    `,
    [EVENT_TYPES.TEAM]
  );
  return rows;
};

const fetchDoublesRows = async () => {
  const { rows } = await query(
    `
    select
      s.lane,
      p.pid,
      p.first_name,
      p.last_name,
      p.nickname,
      d.partner_pid,
      partner.first_name as partner_first_name,
      partner.last_name as partner_last_name,
      partner.nickname as partner_nickname
    from scores s
    inner join people p on p.pid = s.pid
    left join doubles_pairs d on d.pid = p.pid
    left join people partner on partner.pid = d.partner_pid
    where s.event_type = ?
      ${LANE_FILTER_SQL}
    `,
    [EVENT_TYPES.DOUBLES]
  );
  return rows;
};

const fetchSinglesRows = async () => {
  const { rows } = await query(
    `
    select s.lane, p.pid, p.first_name, p.last_name, p.nickname
    from scores s
    inner join people p on p.pid = s.pid
    where s.event_type = ?
      ${LANE_FILTER_SQL}
    `,
    [EVENT_TYPES.SINGLES]
  );
  return rows;
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

    const [teamRows, doublesRows, singlesRows] = await Promise.all([
      fetchTeamRows(),
      fetchDoublesRows(),
      fetchSinglesRows(),
    ]);

    const assignments = buildLaneAssignments({ teamRows, doublesRows, singlesRows });
    res.status(200).json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
