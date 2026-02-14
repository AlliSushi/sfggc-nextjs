import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { XMLParser } from "fast-xml-parser";
import { withTransaction } from "./db.js";
import { toTeamSlug } from "./slug.js";
import { calculateHandicap } from "./handicap-constants.js";
import { EVENT_TYPE_LIST } from "./event-constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local from project root when PORTAL_DATABASE_URL not set (CLI usage).
if (!process.env.PORTAL_DATABASE_URL) {
  const envPath = path.join(__dirname, "../../../.env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}

const toText = (value) => (value === undefined || value === null ? "" : String(value));
const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Sanitize phone number by removing invisible Unicode formatting characters.
 * These characters (like U+202C POP DIRECTIONAL FORMATTING) can cause database
 * encoding issues on servers with non-utf8mb4 character sets.
 *
 * Removes:
 * - U+200E LEFT-TO-RIGHT MARK
 * - U+200F RIGHT-TO-LEFT MARK
 * - U+202A LEFT-TO-RIGHT EMBEDDING
 * - U+202B RIGHT-TO-LEFT EMBEDDING
 * - U+202C POP DIRECTIONAL FORMATTING
 * - U+202D LEFT-TO-RIGHT OVERRIDE
 * - U+202E RIGHT-TO-LEFT OVERRIDE
 * - U+2066 LEFT-TO-RIGHT ISOLATE
 * - U+2067 RIGHT-TO-LEFT ISOLATE
 * - U+2068 FIRST STRONG ISOLATE
 * - U+2069 POP DIRECTIONAL ISOLATE
 * - U+FEFF ZERO WIDTH NO-BREAK SPACE (BOM)
 */
const sanitizePhone = (value) => {
  const str = toText(value);
  if (!str) return "";

  // Remove invisible Unicode formatting characters
  return str.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");
};

const parsePeople = (xmlText) => {
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xmlText);

  const peopleList =
    data?.IGBOTS?.PEOPLES?.PEOPLE ||
    data?.IGBOTS?.PEOPLE ||
    data?.PEOPLES?.PEOPLE ||
    [];
  return Array.isArray(peopleList) ? peopleList : [peopleList];
};

const buildImportRows = (people) => {
  const pidIndex = new Set();
  const teams = new Map();
  const doubles = new Map();
  const scores = [];
  const peopleRows = [];

  people.forEach((person) => {
    const pid = toText(person.ID);
    if (!pid) return;
    pidIndex.add(pid);
  });

  people.forEach((person) => {
    const pid = toText(person.ID);
    if (!pid) return;

    const firstName = toText(person.FIRST_NAME);
    const lastName = toText(person.LAST_NAME);
    const nickname = sanitizePhone(person.NICKNAME);
    const email = toText(person.EMAIL);
    const phone = sanitizePhone(person.PHONE_1 || person.PHONE);
    const birthMonth = toNumber(person.BIRTH_MONTH);
    const birthDay = toNumber(person.BIRTH_DAY);
    const city = toText(person.CITY);
    const region = toText(person.STATE || person.PROVINCE);
    const country = toText(person.COUNTRY);
    const teamId = toText(person.TEAM_ID || person.TEAM_NUMBER);
    const teamName = toText(person.TEAM_NAME);
    const teamSlug = teamName ? toTeamSlug(teamName) : "";
    const teamCaptain = toText(person.TEAM_CAPTAIN).toUpperCase() === "YES";
    const teamOrder = toNumber(person.TEAM_ORDER);
    const doublesId = toText(person.DOUBLES_EXTERNAL_ID);
    const doublesFirstName = toText(person.DOUBLES_FIRST_NAME);
    const doublesLastName = toText(person.DOUBLES_LAST_NAME);
    const bookAvg = toNumber(person.BOOK_AVERAGE?.['#text'] ?? person.BOOK_AVERAGE);

    if (teamId && teamName) {
      teams.set(teamId, {
        tnmt_id: teamId,
        team_name: teamName,
        slug: teamSlug,
      });
    }

    if (doublesId) {
      const partnerPid =
        doublesId && doublesId !== pid && pidIndex.has(doublesId)
          ? doublesId
          : null;
      doubles.set(doublesId, {
        did: doublesId,
        pid,
        partner_pid: partnerPid,
        partner_first_name: doublesFirstName || null,
        partner_last_name: doublesLastName || null,
      });
    }

    peopleRows.push({
      pid,
      first_name: firstName,
      last_name: lastName,
      nickname,
      email,
      phone,
      birth_month: birthMonth,
      birth_day: birthDay,
      city,
      region,
      country,
      tnmt_id: teamId || null,
      did: doublesId || null,
      team_captain: teamCaptain,
      team_order: teamOrder,
    });

    if (bookAvg !== null) {
      const handicap = calculateHandicap(bookAvg);
      EVENT_TYPE_LIST.forEach((eventType) => {
        scores.push({
          pid,
          event_type: eventType,
          lane: null,
          game1: null,
          game2: null,
          game3: null,
          entering_avg: bookAvg,
          handicap: handicap,
        });
      });
    }
  });

  return {
    teams: Array.from(teams.values()),
    doubles: Array.from(doubles.values()),
    peopleRows,
    scores,
  };
};

const importIgboXml = async (xmlText) => {
  const people = parsePeople(xmlText);
  const { teams, doubles, peopleRows, scores } = buildImportRows(people);

  await withTransaction(async (query) => {
    await query(
      `
      alter table teams
        add column if not exists slug text
      `
    );
    await query(
      `
      alter table people
        add column if not exists nickname text,
        add column if not exists team_captain boolean default false,
        add column if not exists team_order int
      `
    );
    await query(
      `
      alter table doubles_pairs
        add column if not exists partner_first_name text,
        add column if not exists partner_last_name text
      `
    );
    await query(
      `
      create table if not exists admins (
        id char(36) primary key,
        email varchar(255) unique not null,
        name text,
        pid varchar(64),
        first_name text,
        last_name text,
        phone varchar(64) unique,
        password_hash text,
        role varchar(64) not null default 'super-admin',
        created_at timestamp default current_timestamp
      )
      `
    );
    await query("alter table admins add column if not exists pid varchar(64)");
    await query("alter table admins add column if not exists first_name text");
    await query("alter table admins add column if not exists last_name text");
    await query("alter table admins add column if not exists phone varchar(64)");
    await query("create index if not exists admins_pid_idx on admins(pid)");
    await query(
      "create unique index if not exists admins_phone_unique_idx on admins(phone)"
    );

    for (const team of teams) {
      await query(
        `
        insert into teams (tnmt_id, team_name, slug)
        values (?,?,?)
        on duplicate key update
          team_name = values(team_name),
          slug = values(slug)
        `,
        [team.tnmt_id, team.team_name, team.slug || null]
      );
    }

    for (const person of peopleRows) {
      await query(
        `
        insert into people (
          pid, first_name, last_name, nickname, email, phone, birth_month, birth_day,
          city, region, country, tnmt_id, did, team_captain, team_order, updated_at
        )
        values (?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?, now())
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
          team_captain = values(team_captain),
          team_order = values(team_order),
          updated_at = now()
        `,
        [
          person.pid,
          person.first_name,
          person.last_name,
          person.nickname,
          person.email,
          person.phone,
          person.birth_month,
          person.birth_day,
          person.city,
          person.region,
          person.country,
          person.tnmt_id,
          person.did,
          person.team_captain,
          person.team_order,
        ]
      );
    }

    for (const pair of doubles) {
      await query(
        `
        insert into doubles_pairs (did, pid, partner_pid, partner_first_name, partner_last_name)
        values (?,?,?,?,?)
        on duplicate key update
          pid = values(pid),
          partner_pid = values(partner_pid),
          partner_first_name = values(partner_first_name),
          partner_last_name = values(partner_last_name)
        `,
        [
          pair.did,
          pair.pid,
          pair.partner_pid,
          pair.partner_first_name,
          pair.partner_last_name,
        ]
      );
    }

    for (const score of scores) {
      await query(
        `
        insert into scores (
          id, pid, event_type, lane, game1, game2, game3, entering_avg, handicap, updated_at
        )
        values (?,?,?,?,?,?,?,?,?, now())
        on duplicate key update
          lane = COALESCE(values(lane), lane),
          game1 = COALESCE(values(game1), game1),
          game2 = COALESCE(values(game2), game2),
          game3 = COALESCE(values(game3), game3),
          entering_avg = values(entering_avg),
          handicap = values(handicap),
          updated_at = now()
        `,
        [
          randomUUID(),
          score.pid,
          score.event_type,
          score.lane,
          score.game1,
          score.game2,
          score.game3,
          score.entering_avg,
          score.handicap,
        ]
      );
    }

    await query(
      `
      update admins
      join people
        on (
          (admins.email is not null and lower(admins.email) = lower(people.email))
          or (admins.phone is not null and admins.phone = people.phone)
        )
      set admins.pid = people.pid
      where admins.pid is null
      `
    );

    await query(
      `
      update admins
      join people on admins.pid = people.pid
      set admins.first_name = people.first_name,
          admins.last_name = people.last_name,
          admins.email = people.email,
          admins.phone = people.phone,
          admins.name = concat_ws(' ', people.first_name, people.last_name)
      `
    );
  });

  return {
    people: peopleRows.length,
    teams: teams.length,
    doubles: doubles.length,
    scores: scores.length,
  };
};

export { importIgboXml, parsePeople, buildImportRows };
