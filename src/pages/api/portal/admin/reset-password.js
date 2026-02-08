import bcrypt from "bcryptjs";
import { query } from "../../../../utils/portal/db.js";
import {
  ADMIN_SESSION_TTL_MS,
  COOKIE_ADMIN,
  COOKIE_ADMIN_RESET,
  buildSessionToken,
  buildCookieString,
  parseCookies,
} from "../../../../utils/portal/session.js";
import { ensureAdminResetTables } from "../../../../utils/portal/admins-server.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";

const MIN_PASSWORD_LENGTH = 12;
const WEAK_TOKENS = ["password", "123456", "qwerty", "letmein", "admin", "welcome"];

const isStrongPassword = (value) => {
  if (!value || value.length < MIN_PASSWORD_LENGTH) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  const lower = value.toLowerCase();
  if (WEAK_TOKENS.some((token) => lower.includes(token))) return false;
  return true;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(req, res, ["POST"]);
    return;
  }

  const { password, confirmPassword } = req.body || {};
  if (!password || !confirmPassword) {
    res.status(400).json({ error: "Password and confirmation are required." });
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({ error: "Passwords do not match." });
    return;
  }
  if (!isStrongPassword(password)) {
    res.status(400).json({ error: "Password does not meet requirements." });
    return;
  }

  try {
    await ensureAdminResetTables();
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies[COOKIE_ADMIN_RESET];
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { rows } = await query(
      `
      select id, admin_id, expires_at, used_at
      from admin_password_resets
      where token = ?
      limit 1
      `,
      [token]
    );
    const reset = rows[0];
    if (!reset || reset.used_at || new Date(reset.expires_at) < new Date()) {
      res.status(401).json({ error: "Reset token is invalid or expired." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await query("update admins set password_hash = ? where id = ?", [
      passwordHash,
      reset.admin_id,
    ]);
    await query("update admin_password_resets set used_at = now() where id = ?", [
      reset.id,
    ]);

    const adminRows = await query(
      "select email, role from admins where id = ?",
      [reset.admin_id]
    );
    const admin = adminRows.rows[0];
    const cookies = [
      buildCookieString(COOKIE_ADMIN_RESET, "", 0),
    ];
    if (admin) {
      const tokenValue = buildSessionToken(
        { email: admin.email, role: admin.role },
        ADMIN_SESSION_TTL_MS
      );
      const maxAgeSeconds = Math.floor(ADMIN_SESSION_TTL_MS / 1000);
      cookies.push(
        buildCookieString(COOKIE_ADMIN, tokenValue, maxAgeSeconds)
      );
    }

    res.setHeader("Set-Cookie", cookies);
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
