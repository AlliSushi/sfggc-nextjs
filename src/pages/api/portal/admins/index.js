import bcrypt from "bcryptjs";
import crypto from "crypto";
import { BCRYPT_ROUNDS } from "../../../../utils/portal/auth-config.js";
import { query, withTransaction } from "../../../../utils/portal/db.js";
import {
  ensureAdminResetTables,
  requireSuperAdmin,
} from "../../../../utils/portal/admins-server.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import { ROLE_SUPER_ADMIN, ROLE_TOURNAMENT_ADMIN } from "../../../../utils/portal/roles.js";
import { sendAdminWelcomeEmail } from "../../../../utils/portal/send-login-email.js";
import {
  ADMIN_PASSWORD_RESET_TTL_MS,
  generateSecureToken,
} from "../../../../utils/portal/session.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      methodNotAllowed(req, res, ["GET", "POST"]);
      return;
    }

    await ensureAdminResetTables();
    const payload = requireSuperAdmin(req, res);
    if (!payload) return;

    if (req.method === "GET") {
      const { rows } = await query(
        `
        select id, email, first_name, last_name, phone, role, pid, created_at
        from admins
        order by created_at desc
        `
      );
      res.status(200).json(rows || []);
      return;
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      pid,
      role = ROLE_TOURNAMENT_ADMIN,
      initialPassword,
    } = req.body || {};
    if (role !== ROLE_SUPER_ADMIN && role !== ROLE_TOURNAMENT_ADMIN) {
      res.status(400).json({ error: "Invalid role." });
      return;
    }
    const normalizedEmail = email?.trim() || "";
    const normalizedPhone = phone?.trim() || "";

    const missing = [];
    if (!firstName) missing.push("first name");
    if (!lastName) missing.push("last name");
    if (!normalizedEmail && !normalizedPhone) missing.push("email or phone");
    if (!initialPassword) missing.push("initial password");
    if (missing.length) {
      res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}.` });
      return;
    }

    const existing = await query(
      `
      select id from admins
      where (? <> '' and lower(email) = lower(?))
         or (? <> '' and phone = ?)
      `,
      [normalizedEmail, normalizedEmail, normalizedPhone, normalizedPhone]
    );
    if (existing.rows.length) {
      res.status(409).json({ error: "Admin already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(initialPassword, BCRYPT_ROUNDS);
    const adminId = crypto.randomUUID();
    const resetToken = generateSecureToken();
    await withTransaction(async (connQuery) => {
      await connQuery(
        `
        insert into admins (id, email, first_name, last_name, phone, password_hash, role, name, pid)
        values (?,?,?,?,?,?,?,?,?)
        `,
        [
          adminId,
          normalizedEmail || null,
          firstName,
          lastName,
          normalizedPhone || null,
          passwordHash,
          role,
          `${firstName} ${lastName}`.trim(),
          pid || null,
        ]
      );
      await connQuery(
        `
        insert into admin_password_resets (admin_id, token, expires_at)
        values (?,?,?)
        `,
        [adminId, resetToken, new Date(Date.now() + ADMIN_PASSWORD_RESET_TTL_MS)]
      );
    });

    try {
      if (normalizedEmail) {
        await sendAdminWelcomeEmail({
          email: normalizedEmail,
          firstName,
          lastName,
          password: initialPassword,
        });
      }
    } catch (emailError) {
      console.error("[admin-create] Welcome email failed:", emailError.message);
      res.status(200).json({ ok: true, warning: "Account created but welcome email could not be sent." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
