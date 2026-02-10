import bcrypt from "bcryptjs";
import { query } from "../../../../utils/portal/db.js";
import {
  ADMIN_SESSION_TTL_MS,
  COOKIE_ADMIN,
  COOKIE_ADMIN_RESET,
  buildSessionToken,
  buildCookieString,
} from "../../../../utils/portal/session.js";
import { ensureAdminResetTables } from "../../../../utils/portal/admins-server.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(req, res, ["POST"]);
    return;
  }

  const { email, phone, password } = req.body || {};
  const identifier =
    (email && String(email).trim()) || (phone && String(phone).trim()) || "";
  if (!identifier || !password) {
    res.status(400).json({ error: "Email or phone and password are required." });
    return;
  }

  try {
    await ensureAdminResetTables();
    const { rows } = await query(
      `
      select id, email, role, password_hash, must_change_password
      from admins
      where lower(email) = lower(?)
         or phone = ?
      limit 1
      `,
      [identifier, identifier]
    );
    const admin = rows[0];
    if (!admin || !admin.password_hash) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    // If admin must change password, ensure a reset token exists
    if (admin.must_change_password) {
      const { rows: existingResetRows } = await query(
        `
        select token
        from admin_password_resets
        where admin_id = ?
          and used_at is null
          and expires_at > now()
        limit 1
        `,
        [admin.id]
      );

      // Use existing token or create a new one
      const resetToken = existingResetRows.length
        ? existingResetRows[0].token
        : await (async () => {
            const crypto = await import("crypto");
            const { generateSecureToken, ADMIN_PASSWORD_RESET_TTL_MS } = await import("../../../../utils/portal/session.js");
            const newToken = generateSecureToken();
            await query(
              `
              insert into admin_password_resets (id, admin_id, token, expires_at)
              values (?, ?, ?, ?)
              `,
              [
                crypto.randomUUID(),
                admin.id,
                newToken,
                new Date(Date.now() + ADMIN_PASSWORD_RESET_TTL_MS),
              ]
            );
            return newToken;
          })();

      res.setHeader(
        "Set-Cookie",
        buildCookieString(COOKIE_ADMIN_RESET, resetToken, 3600)
      );
      res.status(200).json({ ok: true, needsReset: true, email: admin.email });
      return;
    }

    const token = buildSessionToken(
      { email: admin.email, role: admin.role },
      ADMIN_SESSION_TTL_MS
    );
    const maxAgeSeconds = Math.floor(ADMIN_SESSION_TTL_MS / 1000);
    res.setHeader(
      "Set-Cookie",
      buildCookieString(COOKIE_ADMIN, token, maxAgeSeconds)
    );
    res.status(200).json({ ok: true, email: admin.email, role: admin.role });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
