import { query } from "../../../../utils/portal/db.js";
import {
  COOKIE_PARTICIPANT,
  PARTICIPANT_SESSION_TTL_MS,
  buildSessionToken,
  buildCookieString,
} from "../../../../utils/portal/session.js";
import { ensureParticipantLoginTokens } from "../../../../utils/portal/participants-server.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(req, res, ["GET"]);
    return;
  }

  const token = req.query?.token;
  if (!token || typeof token !== "string") {
    res.writeHead(302, { Location: "/portal/participant?expired=1" });
    res.end();
    return;
  }

  try {
    await ensureParticipantLoginTokens();
    const { rows } = await query(
      `
      select token, pid, expires_at, used_at
      from participant_login_tokens
      where token = ?
        and used_at is null
        and expires_at > now()
      limit 1
      `,
      [token]
    );
    const record = rows[0];
    if (!record) {
      res.writeHead(302, { Location: "/portal/participant?expired=1" });
      res.end();
      return;
    }

    await query(
      `
      update participant_login_tokens
      set used_at = now()
      where token = ?
      `,
      [token]
    );

    const sessionToken = buildSessionToken(
      { role: "participant", pid: record.pid },
      PARTICIPANT_SESSION_TTL_MS
    );
    const maxAgeSeconds = Math.floor(PARTICIPANT_SESSION_TTL_MS / 1000);
    res.setHeader(
      "Set-Cookie",
      buildCookieString(COOKIE_PARTICIPANT, sessionToken, maxAgeSeconds)
    );
    res.writeHead(302, { Location: `/portal/participant/${record.pid}` });
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
