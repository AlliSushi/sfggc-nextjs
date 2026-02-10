import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "../../../../utils/portal/auth-config.js";
import { query } from "../../../../utils/portal/db.js";
import {
  COOKIE_ADMIN_RESET,
  buildExpiredCookie,
  parseCookies,
} from "../../../../utils/portal/session.js";
import { ensureAdminResetTables } from "../../../../utils/portal/admins-server.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import { validatePassword } from "../../../../utils/portal/validators.js";

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
  const passwordError = validatePassword(password);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
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

    // Get current password hash to ensure new password is different
    const { rows: adminRows } = await query(
      "select password_hash from admins where id = ? limit 1",
      [reset.admin_id]
    );
    const admin = adminRows[0];
    if (!admin) {
      res.status(404).json({ error: "Admin not found." });
      return;
    }

    // Validate new password is different from current password
    const isSamePassword = await bcrypt.compare(password, admin.password_hash);
    if (isSamePassword) {
      res.status(400).json({ error: "New password must be different from your current password." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await query("update admins set password_hash = ?, must_change_password = false where id = ?", [
      passwordHash,
      reset.admin_id,
    ]);
    await query(
      "update admin_password_resets set used_at = now() where admin_id = ? and used_at is null",
      [reset.admin_id]
    );

    res.setHeader("Set-Cookie", buildExpiredCookie(COOKIE_ADMIN_RESET));
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
