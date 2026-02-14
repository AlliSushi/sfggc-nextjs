import { query } from "../../../../utils/portal/db.js";
import { toTeamSlug } from "../../../../utils/portal/slug.js";
import { getAuthSessions } from "../../../../utils/portal/auth-guards.js";
import { forbidden, methodNotAllowed, unauthorized } from "../../../../utils/portal/http.js";
import { filterNonNull } from "../../../../utils/portal/array-helpers.js";
import { buildDisplayName } from "../../../../utils/portal/name-helpers.js";
import { EVENT_TYPES } from "../../../../utils/portal/event-constants.js";


const sortByTeamOrder = (a, b) => {
  const orderA = a.team_order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.team_order ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  const lastCompare = (a.last_name || "").localeCompare(b.last_name || "");
  if (lastCompare !== 0) return lastCompare;
  return (a.first_name || "").localeCompare(b.first_name || "");
};

const resolvePartner = ({ member, memberIndex, didIndex }) => {
  if (member.partner_pid && memberIndex.has(member.partner_pid)) {
    return memberIndex.get(member.partner_pid);
  }
  if (member.did && didIndex.has(member.did)) {
    const partner = didIndex.get(member.did).find((pid) => pid !== member.pid);
    if (partner && memberIndex.has(partner)) {
      return memberIndex.get(partner);
    }
  }
  if (member.partner_first_name && member.partner_last_name) {
    const match = [...memberIndex.values()].find(
      (person) =>
        person.pid !== member.pid &&
        person.first_name?.toLowerCase() === member.partner_first_name.toLowerCase() &&
        person.last_name?.toLowerCase() === member.partner_last_name.toLowerCase()
    );
    if (match) return match;
  }
  return null;
};

const orderRoster = (roster) => {
  if (!roster.length) return [];

  const memberIndex = new Map(roster.map((member) => [member.pid, member]));
  const didIndex = new Map();
  roster.forEach((member) => {
    if (!member.did) return;
    const list = didIndex.get(member.did) || [];
    list.push(member.pid);
    didIndex.set(member.did, list);
  });

  const rosterWithPartner = roster.map((member) => ({
    ...member,
    partner: resolvePartner({ member, memberIndex, didIndex }),
  }));

  const captain = rosterWithPartner.find((member) => member.team_captain);
  if (!captain) {
    return rosterWithPartner.sort(sortByTeamOrder);
  }

  const ordered = [];
  const used = new Set();
  ordered.push(captain);
  used.add(captain.pid);
  if (captain.partner) {
    ordered.push(captain.partner);
    used.add(captain.partner.pid);
  }

  const remaining = rosterWithPartner
    .filter((member) => !used.has(member.pid))
    .sort(sortByTeamOrder);

  while (remaining.length) {
    const next = remaining.shift();
    if (!next || used.has(next.pid)) continue;
    ordered.push(next);
    used.add(next.pid);
    if (next.partner && !used.has(next.partner.pid)) {
      ordered.push(next.partner);
      used.add(next.partner.pid);
      const partnerIndex = remaining.findIndex(
        (member) => member.pid === next.partner.pid
      );
      if (partnerIndex >= 0) {
        remaining.splice(partnerIndex, 1);
      }
    }
  }

  return ordered;
};

const resolveParticipantTeamSlug = async (pid) => {
  const { rows } = await query(
    `
    select t.team_name, t.slug
    from people p
    left join teams t on p.tnmt_id = t.tnmt_id
    where p.pid = ?
    limit 1
    `,
    [pid]
  );
  const team = rows?.[0];
  if (!team) {
    return null;
  }
  return team.slug || (team.team_name ? toTeamSlug(team.team_name) : null);
};

const authenticateRequest = (req, res) => {
  const { adminSession, participantSession } = getAuthSessions(req);
  if (!adminSession && !participantSession) {
    unauthorized(res);
    return null;
  }
  return { adminSession, participantSession };
};

const authorizeParticipant = async (teamSlug, participantSession, res) => {
  if (!participantSession) {
    return true;
  }
  const participantTeamSlug = await resolveParticipantTeamSlug(participantSession.pid);
  const normalizedRequest = toTeamSlug(teamSlug || "");
  const allowedSlugs = new Set(
    [participantTeamSlug, toTeamSlug(participantTeamSlug || "")].filter(Boolean)
  );
  if (!participantTeamSlug || !allowedSlugs.has(normalizedRequest)) {
    forbidden(res);
    return false;
  }
  return true;
};

const fetchTeamBySlug = async (teamSlug) => {
  const { rows } = await query("select * from teams where slug = ?", [teamSlug]);
  if (rows?.[0]) return rows[0];

  // Fallback: match by generated slug from team_name for teams without a slug column
  const { rows: allTeams } = await query("select * from teams where slug is null");
  return allTeams?.find((t) => toTeamSlug(t.team_name) === teamSlug) || null;
};

const fetchTeamMembers = async (tnmtId) => {
  const { rows: members } = await query(
    `
      select
        p.pid,
        p.first_name,
        p.last_name,
        p.nickname,
        p.city,
        p.region,
        p.country,
        p.tnmt_id,
        p.did,
        p.team_captain,
        p.team_order,
        d.partner_pid,
        d.partner_first_name,
        d.partner_last_name,
        s.lane as team_lane,
        s.game1 as team_game1,
        s.game2 as team_game2,
        s.game3 as team_game3
      from people p
      left join doubles_pairs d on d.pid = p.pid
      left join scores s on s.pid = p.pid and s.event_type = ?
      where p.tnmt_id = ?
      `,
    [EVENT_TYPES.TEAM, tnmtId]
  );
  return members;
};

const resolveTeamLocation = (members) => {
  return (
    members.find(
      (member) => member.team_captain && (member.city || member.region || member.country)
    ) ||
    members.find((member) => member.city || member.region || member.country) ||
    null
  );
};

const extractTeamScores = (members) => {
  const scoreSource = members.find(
    (m) => m.team_game1 != null || m.team_game2 != null || m.team_game3 != null
  );
  return scoreSource
    ? filterNonNull([scoreSource.team_game1, scoreSource.team_game2, scoreSource.team_game3])
    : [];
};

const extractTeamLane = (members) => {
  const laneSource = members.find((member) => member.team_lane);
  return laneSource?.team_lane || "";
};

const buildRosterResponse = (members) => {
  return members.map((member) => ({
    pid: member.pid,
    name: buildDisplayName(member),
    isCaptain: Boolean(member.team_captain),
    teamOrder: member.team_order,
    doublesPartnerPid: member.partner?.pid || "",
    doublesPartnerName: member.partner ? buildDisplayName(member.partner) : "",
  }));
};

export default async function handler(req, res) {
  const { teamSlug } = req.query;

  try {
    if (req.method !== "GET") {
      methodNotAllowed(req, res, ["GET"]);
      return;
    }

    const sessions = authenticateRequest(req, res);
    if (!sessions) {
      return;
    }

    const authorized = await authorizeParticipant(teamSlug, sessions.participantSession, res);
    if (!authorized) {
      return;
    }

    const team = await fetchTeamBySlug(teamSlug);
    if (!team) {
      res.status(404).json({ error: "Team not found." });
      return;
    }

    const members = await fetchTeamMembers(team.tnmt_id);
    const orderedMembers = orderRoster(members);
    const locationSource = resolveTeamLocation(orderedMembers);
    const teamScores = extractTeamScores(orderedMembers);
    const teamLane = extractTeamLane(orderedMembers);
    const orderedRoster = buildRosterResponse(orderedMembers);

    res.status(200).json({
      team: {
        tnmtId: team.tnmt_id,
        name: team.team_name,
        slug: team.slug,
        lane: teamLane,
        scores: teamScores,
        location: locationSource
          ? {
              city: locationSource.city || "",
              region: locationSource.region || "",
              country: locationSource.country || "",
            }
          : null,
      },
      roster: orderedRoster,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
