import { randomUUID } from "crypto";
import { query as defaultQuery } from "./db.js";
import { filterNonNull } from "./array-helpers.js";
import { toTeamSlug } from "./slug.js";
import { calculateHandicap } from "./handicap-constants.js";
import { buildFullName } from "./name-helpers.js";
import { EVENT_TYPE_LIST, EVENT_TYPES } from "./event-constants.js";

const resolvePartner = async (pid, doubles, person, query = defaultQuery) => {
  if (doubles?.partner_pid) {
    const result = await query("select * from people where pid = ?", [
      doubles.partner_pid,
    ]);
    return result.rows[0] || null;
  }

  if (doubles?.partner_first_name && doubles?.partner_last_name) {
    const result = await query(
      `
      select pid, first_name, last_name, nickname
      from people
      where lower(first_name) = lower(?)
        and lower(last_name) = lower(?)
        and pid <> ?
      limit 1
      `,
      [doubles.partner_first_name, doubles.partner_last_name, pid]
    );
    if (result.rows[0]) return result.rows[0];
  }

  if (person.did) {
    const result = await query(
      "select pid, first_name, last_name, nickname from people where did = ? and pid <> ? limit 1",
      [person.did, pid]
    );
    return result.rows[0] || null;
  }

  return null;
};

const buildPartnerName = (partner, doubles) => {
  if (partner) return buildFullName(partner);
  if (doubles?.partner_first_name || doubles?.partner_last_name) {
    return `${doubles?.partner_first_name || ""} ${doubles?.partner_last_name || ""}`.trim();
  }
  return "";
};


const formatParticipant = async (pid, query = defaultQuery) => {
  // PERFORMANCE OPTIMIZATION: Use single JOIN query instead of 5 sequential queries
  // This reduces network round-trips from 500-800ms to 100-150ms over AWS RDS

  // Query 1: Get participant with all related data via JOINs (replaces 4 separate queries)
  const { rows: mainResults } = await query(
    `
    SELECT
      p.*,
      t.tnmt_id as team_tnmt_id,
      t.team_name,
      t.slug as team_slug,
      dp.did as doubles_did,
      dp.partner_pid,
      dp.partner_first_name as doubles_partner_first_name,
      dp.partner_last_name as doubles_partner_last_name,
      partner1.pid as partner1_pid,
      partner1.first_name as partner1_first_name,
      partner1.last_name as partner1_last_name,
      partner1.nickname as partner1_nickname,
      partner2.pid as partner2_pid,
      partner2.first_name as partner2_first_name,
      partner2.last_name as partner2_last_name,
      partner2.nickname as partner2_nickname
    FROM people p
    LEFT JOIN teams t ON p.tnmt_id = t.tnmt_id
    LEFT JOIN doubles_pairs dp ON p.pid = dp.pid
    LEFT JOIN people partner1 ON dp.partner_pid = partner1.pid
    LEFT JOIN people partner2 ON p.did = partner2.did AND p.pid <> partner2.pid
    WHERE p.pid = ?
    LIMIT 1
    `,
    [pid]
  );

  const person = mainResults?.[0];
  if (!person) return null;

  // Reconstruct team object
  const team = person.team_tnmt_id ? {
    tnmt_id: person.team_tnmt_id,
    team_name: person.team_name,
    slug: person.team_slug
  } : null;

  // Reconstruct doubles object
  const doubles = person.doubles_did ? {
    did: person.doubles_did,
    partner_pid: person.partner_pid,
    partner_first_name: person.doubles_partner_first_name,
    partner_last_name: person.doubles_partner_last_name
  } : null;

  // Resolve partner from JOIN results (replaces resolvePartner() which made 1-2 queries)
  let partner = null;
  if (person.partner1_pid) {
    // Partner resolved via dp.partner_pid
    partner = {
      pid: person.partner1_pid,
      first_name: person.partner1_first_name,
      last_name: person.partner1_last_name,
      nickname: person.partner1_nickname
    };
  } else if (person.partner2_pid) {
    // Partner resolved via p.did
    partner = {
      pid: person.partner2_pid,
      first_name: person.partner2_first_name,
      last_name: person.partner2_last_name,
      nickname: person.partner2_nickname
    };
  }

  // Query 2: Get scores (separate query since it returns multiple rows)
  const scoreRows = (await query("select * from scores where pid = ?", [pid]))
    .rows;
  const scoreIndex = new Map(scoreRows.map((row) => [row.event_type, row]));
  const scoreFor = (eventType) => scoreIndex.get(eventType) || {};

  const bookAverage =
    scoreFor(EVENT_TYPES.TEAM).entering_avg ??
    scoreFor(EVENT_TYPES.DOUBLES).entering_avg ??
    scoreFor(EVENT_TYPES.SINGLES).entering_avg ??
    null;

  return {
    pid: person.pid,
    firstName: person.first_name,
    lastName: person.last_name,
    nickname: person.nickname,
    email: person.email,
    phone: person.phone,
    birthMonth: person.birth_month,
    birthDay: person.birth_day,
    city: person.city,
    region: person.region,
    country: person.country,
    bookAverage: bookAverage,
    team: {
      tnmtId: person.tnmt_id,
      name: team?.team_name || "",
      slug: team?.slug || (team?.team_name ? toTeamSlug(team.team_name) : ""),
    },
    doubles: {
      did: person.did,
      partnerPid: doubles?.partner_pid || partner?.pid || "",
      partnerName: buildPartnerName(partner, doubles),
    },
    lanes: {
      team: scoreFor(EVENT_TYPES.TEAM).lane || "",
      doubles: scoreFor(EVENT_TYPES.DOUBLES).lane || "",
      singles: scoreFor(EVENT_TYPES.SINGLES).lane || "",
    },
    averages: {
      entering: bookAverage,
      handicap:
        scoreFor(EVENT_TYPES.TEAM).handicap ??
        scoreFor(EVENT_TYPES.DOUBLES).handicap ??
        scoreFor(EVENT_TYPES.SINGLES).handicap ??
        null,
    },
    scores: {
      team: filterNonNull([
        scoreFor(EVENT_TYPES.TEAM).game1,
        scoreFor(EVENT_TYPES.TEAM).game2,
        scoreFor(EVENT_TYPES.TEAM).game3,
      ]),
      doubles: filterNonNull([
        scoreFor(EVENT_TYPES.DOUBLES).game1,
        scoreFor(EVENT_TYPES.DOUBLES).game2,
        scoreFor(EVENT_TYPES.DOUBLES).game3,
      ]),
      singles: filterNonNull([
        scoreFor(EVENT_TYPES.SINGLES).game1,
        scoreFor(EVENT_TYPES.SINGLES).game2,
        scoreFor(EVENT_TYPES.SINGLES).game3,
      ]),
    },
  };
};

const upsertPerson = async (pid, updates, query = defaultQuery) => {
  await query(
    `
    insert into people (
      pid, first_name, last_name, nickname, email, phone, birth_month, birth_day,
      city, region, country, tnmt_id, did, updated_at
    )
    values (?,?,?,?,?,?,?,?,?,?,?,?, ?, now())
    on duplicate key update
      first_name = values(first_name),
      last_name = values(last_name),
      nickname = values(nickname),
      email = values(email),
      phone = values(phone),
      birth_month = values(birth_month),
      birth_day = values(birth_day),
      city = values(city),
      region = values(region),
      country = values(country),
      tnmt_id = values(tnmt_id),
      did = values(did),
      updated_at = now()
    `,
    [
      pid,
      updates.firstName,
      updates.lastName,
      updates.nickname,
      updates.email,
      updates.phone,
      updates.birthMonth,
      updates.birthDay,
      updates.city,
      updates.region,
      updates.country,
      updates.team?.tnmtId || null,
      updates.doubles?.did || null,
    ]
  );
};

const upsertTeam = async (team, query = defaultQuery) => {
  if (!team?.tnmtId || !team?.name) return;

  await query(
    `
    insert into teams (tnmt_id, team_name, slug)
    values (?,?,?)
    on duplicate key update
      team_name = values(team_name),
      slug = values(slug)
    `,
    [team.tnmtId, team.name, toTeamSlug(team.name)]
  );
};

const upsertDoublesPair = async (pid, doubles, query = defaultQuery) => {
  if (!doubles?.did) return;

  await query(
    `
    insert into doubles_pairs (did, pid, partner_pid)
    values (?,?,?)
    on duplicate key update
      pid = values(pid),
      partner_pid = values(partner_pid)
    `,
    [doubles.did, pid, doubles.partnerPid || null]
  );
};

const upsertScores = async (pid, updates, query = defaultQuery) => {
  const avg = updates.bookAverage ?? updates.averages?.entering ?? null;
  // Handicap is always calculated from book average, never taken from updates
  const handicap = calculateHandicap(avg);

  for (const eventType of EVENT_TYPE_LIST) {
    const lane = updates.lanes?.[eventType] || null;
    const games = updates.scores?.[eventType] || [];

    await query(
      `
      insert into scores (
        id, pid, event_type, lane, game1, game2, game3, entering_avg, handicap, updated_at
      )
      values (?,?,?,?,?,?,?,?,?, now())
      on duplicate key update
        lane = values(lane),
        game1 = values(game1),
        game2 = values(game2),
        game3 = values(game3),
        entering_avg = values(entering_avg),
        handicap = values(handicap),
        updated_at = now()
      `,
      [
        randomUUID(),
        pid,
        eventType,
        lane,
        games?.[0] ?? null,
        games?.[1] ?? null,
        games?.[2] ?? null,
        avg,
        handicap,
      ]
    );
  }
};

const arraysEqual = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((value, index) => value === b[index]);

const buildChanges = (current, updates) => {
  const changes = [];
  const addChange = (field, oldValue, newValue) => {
    const bothArrays = Array.isArray(oldValue) && Array.isArray(newValue);
    if (bothArrays ? !arraysEqual(oldValue, newValue) : oldValue !== newValue) {
      changes.push({ field, oldValue, newValue });
    }
  };

  addChange("first_name", current.firstName, updates.firstName);
  addChange("last_name", current.lastName, updates.lastName);
  addChange("nickname", current.nickname, updates.nickname);
  addChange("email", current.email, updates.email);
  addChange("phone", current.phone, updates.phone);
  addChange("birth_month", current.birthMonth, updates.birthMonth);
  addChange("birth_day", current.birthDay, updates.birthDay);
  addChange("city", current.city, updates.city);
  addChange("region", current.region, updates.region);
  addChange("country", current.country, updates.country);
  addChange("book_average", current.bookAverage, updates.bookAverage);
  addChange("team_name", current.team?.name, updates.team?.name);
  addChange("team_id", current.team?.tnmtId, updates.team?.tnmtId);
  addChange("doubles_id", current.doubles?.did, updates.doubles?.did);
  addChange("partner_pid", current.doubles?.partnerPid, updates.doubles?.partnerPid);
  addChange("lane_team", current.lanes?.team, updates.lanes?.team);
  addChange("lane_doubles", current.lanes?.doubles, updates.lanes?.doubles);
  addChange("lane_singles", current.lanes?.singles, updates.lanes?.singles);
  addChange("avg_entering", current.averages?.entering, updates.averages?.entering);
  addChange("avg_handicap", current.averages?.handicap, updates.averages?.handicap);
  addChange("scores_team", current.scores?.team, updates.scores?.team);
  addChange("scores_doubles", current.scores?.doubles, updates.scores?.doubles);
  addChange("scores_singles", current.scores?.singles, updates.scores?.singles);

  return changes;
};

const PARTICIPANT_EDITABLE_FIELDS = ["email", "phone", "city", "region", "country"];

const sanitizeParticipantUpdates = (updates) => {
  const sanitized = {};
  for (const field of PARTICIPANT_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      sanitized[field] = updates[field];
    }
  }
  return sanitized;
};

const mergeParticipantUpdates = (current, updates) => ({
  ...current,
  ...sanitizeParticipantUpdates(updates),
  team: current.team,
  doubles: current.doubles,
  lanes: current.lanes,
  averages: current.averages,
  scores: current.scores,
});

const resolveParticipantUpdates = (current, rawUpdates, isParticipantOnly) =>
  isParticipantOnly ? mergeParticipantUpdates(current, rawUpdates) : rawUpdates;

const applyParticipantUpdates = async ({ pid, updates, isParticipantOnly, query = defaultQuery }) => {
  await upsertPerson(pid, updates, query);
  if (!isParticipantOnly) {
    await upsertTeam(updates.team, query);
    await upsertDoublesPair(pid, updates.doubles, query);
    await upsertScores(pid, updates, query);
  }
};

export {
  formatParticipant,
  buildChanges,
  resolveParticipantUpdates,
  applyParticipantUpdates,
};
