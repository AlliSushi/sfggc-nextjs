import crypto from "crypto";
import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "../../../../../utils/portal/auth-config.js";
import { query, withTransaction } from "../../../../../utils/portal/db.js";
import {
  ensureAdminActionsTables,
  requireSuperAdmin,
} from "../../../../../utils/portal/admins-server.js";
import { methodNotAllowed } from "../../../../../utils/portal/http.js";
import { generateStrongPassword } from "../../../../../utils/portal/password-generator.js";
import { sendForcedPasswordResetEmail } from "../../../../../utils/portal/send-login-email.js";

async function handlePost(req, res) {
  await ensureAdminActionsTables();
  const payload = await requireSuperAdmin(req, res);
  if (!payload) return;

  const { id } = req.query;

  // Validate admin exists
  const { rows } = await query(
    "select id, email, first_name, last_name from admins where id = ?",
    [id]
  );
  const target = rows[0];
  if (!target) {
    res.status(404).json({ error: "Admin not found." });
    return;
  }

  // Cannot force password change on self
  if (target.email === payload.email) {
    res.status(403).json({ error: "Cannot force password change on your own account." });
    return;
  }

  // Generate new temporary password
  const temporaryPassword = generateStrongPassword(16);
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

  // Update admin record with new password, force change flag, and revoke sessions
  const actionId = crypto.randomUUID();
  await withTransaction(async (connQuery) => {
    await connQuery(
      `update admins
       set password_hash = ?, must_change_password = true, sessions_revoked_at = NOW()
       where id = ?`,
      [passwordHash, id]
    );

    // Log admin action
    await connQuery(
      "INSERT INTO admin_actions (id, admin_email, action, details) VALUES (?, ?, ?, ?)",
      [
        actionId,
        payload.email,
        "force_password_change",
        JSON.stringify({
          targetAdminId: id,
          targetAdminEmail: target.email,
        }),
      ]
    );

    // Send email with temporary password
    await sendForcedPasswordResetEmail({
      email: target.email,
      firstName: target.first_name || "",
      lastName: target.last_name || "",
      temporaryPassword,
      query: connQuery,
    });
  });

  res.status(200).json({
    ok: true,
    message: "Password reset. Admin will receive email with temporary password.",
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(req, res, ["POST"]);
    return;
  }

  try {
    await handlePost(req, res);
  } catch (error) {
    console.error("[force-password-change] Error:", error);
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
