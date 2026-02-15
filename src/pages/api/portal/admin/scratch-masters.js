import { query } from "../../../../utils/portal/db.js";
import {
  methodNotAllowed,
  forbidden,
  internalServerError,
} from "../../../../utils/portal/http.js";
import { requireAnySession } from "../../../../utils/portal/auth-guards.js";
import { EVENT_TYPE_LIST } from "../../../../utils/portal/event-constants.js";
import { buildScratchMasters } from "../../../../utils/portal/scratch-masters.js";
import { getScratchMastersVisibleToParticipants } from "../../../../utils/portal/portal-settings-db.js";

const fetchScratchMastersRows = async () => {
  const { rows } = await query(
    `
    select p.division, p.pid, p.first_name, p.last_name, p.nickname,
           s.event_type, s.game1, s.game2, s.game3
    from people p
    left join scores s
      on s.pid = p.pid and s.event_type in (?, ?, ?)
    where p.division is not null and p.division <> ''
      and p.scratch_masters = 1
    order by p.division, p.last_name, p.first_name
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
    const auth = await requireAnySession(req, res);
    if (!auth) return;

    if (!auth.adminSession) {
      const participantsCanViewScratchMasters = await getScratchMastersVisibleToParticipants();
      if (!participantsCanViewScratchMasters) {
        forbidden(res);
        return;
      }
    }

    const rows = await fetchScratchMastersRows();
    const standings = buildScratchMasters(rows);
    res.status(200).json(standings);
  } catch (error) {
    internalServerError(res, error);
  }
}
