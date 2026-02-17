import crypto from "crypto";
import { query } from "../../../../utils/portal/db.js";
import { ensureAdminResetTables } from "../../../../utils/portal/admins-server.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import {
  sendPasswordResetEmail,
  buildResetUrl,
} from "../../../../utils/portal/send-login-email.js";
import {
  ADMIN_PASSWORD_RESET_TTL_MS,
  generateSecureToken,
} from "../../../../utils/portal/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(req, res, ["POST"]);
    return;
  }

  try {
    await ensureAdminResetTables();

    const { email } = req.body || {};
    if (!email) {
      res.status(200).json({ ok: true });
      return;
    }

    const { rows } = await query(
      "select id, email, first_name from admins where lower(email) = lower(?)",
      [email.trim()]
    );
    const admin = rows[0];

    if (admin) {
      const token = generateSecureToken();
      const resetId = crypto.randomUUID();
      await query(
        "insert into admin_password_resets (id, admin_id, token, expires_at) values (?, ?, ?, ?)",
        [resetId, admin.id, token, new Date(Date.now() + ADMIN_PASSWORD_RESET_TTL_MS)]
      );

      const resetUrl = buildResetUrl(token);
      try {
        await sendPasswordResetEmail({
          email: admin.email,
          firstName: admin.first_name || "",
          resetUrl,
        });
      } catch (emailError) {
        console.error("[request-reset] Email send failed:", emailError.message);
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[request-reset] Unexpected error:", error.message);
    res.status(200).json({ ok: true });
  }
}
