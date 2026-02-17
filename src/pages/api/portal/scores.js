import { query } from "../../../utils/portal/db.js";
import {
  methodNotAllowed,
  unauthorized,
  forbidden,
  internalServerError,
} from "../../../utils/portal/http.js";
import { EVENT_TYPES } from "../../../utils/portal/event-constants.js";
import { buildScoreStandings } from "../../../utils/portal/score-standings.js";
import { getAuthSessions, validateAdminSession } from "../../../utils/portal/auth-guards.js";
import { getScoresVisibleToParticipants } from "../../../utils/portal/portal-settings-db.js";

const fetchTeamRows = async () => {
  const { rows } = await query(
    `
    select t.tnmt_id, t.team_name, t.slug,
           p.pid, p.first_name, p.last_name, p.nickname,
           s.game1, s.game2, s.game3, s.handicap
    from teams t
    join people p on p.tnmt_id = t.tnmt_id
    left join scores s on s.pid = p.pid and s.event_type = ?
    order by t.team_name
    `,
    [EVENT_TYPES.TEAM]
  );
  return rows;
};

const fetchDoublesRows = async () => {
  const { rows } = await query(
    `
    select least(dp.pid, coalesce(dp.partner_pid, dp.pid)) as did,
           p.pid, p.first_name, p.last_name, p.nickname,
           s.game1, s.game2, s.game3, s.handicap
    from doubles_pairs dp
    join people p on p.pid = dp.pid
    left join scores s on s.pid = p.pid and s.event_type = ?
    order by did
    `,
    [EVENT_TYPES.DOUBLES]
  );
  return rows;
};

const fetchSinglesRows = async () => {
  const { rows } = await query(
    `
    select p.pid, p.first_name, p.last_name, p.nickname,
           s.game1, s.game2, s.game3, s.handicap
    from people p
    join scores s on s.pid = p.pid and s.event_type = ?
    order by p.last_name, p.first_name
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

    const { adminSession, participantSession } = getAuthSessions(req);
    const validatedAdmin = adminSession ? await validateAdminSession(adminSession, res) : null;
    if (adminSession && !validatedAdmin) return;

    const isAdmin = Boolean(validatedAdmin);
    const isParticipant = Boolean(participantSession);
    if (!isAdmin) {
      const participantsCanViewScores = await getScoresVisibleToParticipants();
      if (!participantsCanViewScores) {
        if (isParticipant) forbidden(res);
        else unauthorized(res);
        return;
      }
    }

    const [teamRows, doublesRows, singlesRows] = await Promise.all([
      fetchTeamRows(),
      fetchDoublesRows(),
      fetchSinglesRows(),
    ]);

    const standings = buildScoreStandings({ teamRows, doublesRows, singlesRows });
    res.status(200).json(standings);
  } catch (error) {
    internalServerError(res, error);
  }
}
