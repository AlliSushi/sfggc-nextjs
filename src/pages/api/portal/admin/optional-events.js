import { query } from "../../../../utils/portal/db.js";
import {
  methodNotAllowed,
  unauthorized,
  forbidden,
  internalServerError,
} from "../../../../utils/portal/http.js";
import { getAuthSessions, validateAdminSession } from "../../../../utils/portal/auth-guards.js";
import { EVENT_TYPE_LIST } from "../../../../utils/portal/event-constants.js";
import { buildOptionalEventsStandings } from "../../../../utils/portal/optional-events.js";
import { getOptionalEventsVisibleToParticipants } from "../../../../utils/portal/portal-settings-db.js";
import {
  getOptionalEventsColumnSupport,
  tryEnsureOptionalEventsColumns,
} from "../../../../utils/portal/optional-events-db.js";

const fetchOptionalEventRows = async (columnSupport) => {
  const legacyOptionalExpr = columnSupport.optional_events
    ? "coalesce(p.optional_events, 0)"
    : "0";
  const best3Expr = columnSupport.optional_best_3_of_9
    ? "coalesce(p.optional_best_3_of_9, 0)"
    : legacyOptionalExpr;
  const scratchExpr = columnSupport.optional_scratch
    ? "coalesce(p.optional_scratch, 0)"
    : legacyOptionalExpr;
  const allHdcpExpr = columnSupport.optional_all_events_hdcp
    ? "coalesce(p.optional_all_events_hdcp, 0)"
    : legacyOptionalExpr;
  const optionalEventsExpr = legacyOptionalExpr;

  const whereClauses = [];
  if (columnSupport.optional_best_3_of_9) whereClauses.push("p.optional_best_3_of_9 = 1");
  if (columnSupport.optional_scratch) whereClauses.push("p.optional_scratch = 1");
  if (columnSupport.optional_all_events_hdcp) whereClauses.push("p.optional_all_events_hdcp = 1");
  if (whereClauses.length === 0 && columnSupport.optional_events) whereClauses.push("p.optional_events = 1");
  const whereCondition = whereClauses.length > 0 ? `(${whereClauses.join(" or ")})` : "1 = 0";

  const { rows } = await query(
    `
    select p.pid, p.first_name, p.last_name, p.nickname, p.division,
           ${optionalEventsExpr} as optional_events,
           ${best3Expr} as optional_best_3_of_9,
           ${scratchExpr} as optional_scratch,
           ${allHdcpExpr} as optional_all_events_hdcp,
           s.event_type, s.game1, s.game2, s.game3, s.handicap
    from people p
    left join scores s
      on s.pid = p.pid and s.event_type in (?, ?, ?)
    where ${whereCondition}
    order by p.last_name, p.first_name
    `,
    EVENT_TYPE_LIST
  );
  return rows;
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(req, res, ["GET"]);
    return;
  }

  try {
    await tryEnsureOptionalEventsColumns();
    const columnSupport = await getOptionalEventsColumnSupport();

    const { adminSession, participantSession } = getAuthSessions(req);
    const validatedAdmin = adminSession ? await validateAdminSession(adminSession, res) : null;
    if (adminSession && !validatedAdmin) return;

    const isAdmin = Boolean(validatedAdmin);
    const isParticipant = Boolean(participantSession);
    if (!isAdmin) {
      const participantsCanViewOptionalEvents = await getOptionalEventsVisibleToParticipants();
      if (!participantsCanViewOptionalEvents) {
        if (isParticipant) forbidden(res);
        else unauthorized(res);
        return;
      }
    }

    const rows = await fetchOptionalEventRows(columnSupport);
    const standings = buildOptionalEventsStandings(rows);
    res.status(200).json(standings);
  } catch (error) {
    internalServerError(res, error);
  }
}
