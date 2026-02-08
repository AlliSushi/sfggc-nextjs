import crypto from "crypto";
import { query } from "../../../../utils/portal/db.js";
import { PARTICIPANT_LINK_TTL_MS, getAdminSession } from "../../../../utils/portal/session.js";
import { ensureParticipantLoginTokens } from "../../../../utils/portal/participants-server.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import { sendLoginEmail } from "../../../../utils/portal/send-login-email.js";

const buildToken = () => crypto.randomBytes(24).toString("hex");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(req, res, ["POST"]);
    return;
  }

  const { identifier, email } = req.body || {};
  const input =
    typeof identifier === "string" && identifier.trim()
      ? identifier
      : typeof email === "string" && email.trim()
        ? email
        : "";
  if (!input) {
    res.status(400).json({ error: "Email address is required." });
    return;
  }

  try {
    await ensureParticipantLoginTokens();
    const normalized = input.trim();
    const { rows } = await query(
      `
      select pid
      from people
      where lower(email) = lower(?)
      limit 1
      `,
      [normalized]
    );

    if (!rows.length) {
      res.status(200).json({ ok: true });
      return;
    }

    const token = buildToken();
    const expiresAt = new Date(Date.now() + PARTICIPANT_LINK_TTL_MS);
    await query(
      `
      insert into participant_login_tokens (token, pid, expires_at)
      values (?,?,?)
      `,
      [token, rows[0].pid, expiresAt]
    );

    await sendLoginEmail({ email: normalized, token });

    const adminSession = getAdminSession(req.headers.cookie || "");
    const response = { ok: true };
    if (adminSession) {
      response.token = token;
    }
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
