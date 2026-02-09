import crypto from "crypto";
import { query, withTransaction } from "../../../../utils/portal/db.js";
import {
  ensureAdminActionsTables,
  requireSuperAdmin,
} from "../../../../utils/portal/admins-server.js";
import { requireAdmin } from "../../../../utils/portal/auth-guards.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import { ROLE_SUPER_ADMIN, ROLE_TOURNAMENT_ADMIN } from "../../../../utils/portal/roles.js";

const ALLOWED_METHODS = ["GET", "PATCH", "DELETE"];

const VALID_ROLES = [ROLE_SUPER_ADMIN, ROLE_TOURNAMENT_ADMIN];

async function handleGet(req, res) {
  await ensureAdminActionsTables();
  const payload = requireSuperAdmin(req, res);
  if (!payload) return;

  const { id } = req.query;
  const { rows } = await query(
    `select id, email, first_name, last_name, phone, role, pid, created_at
     from admins where id = ?`,
    [id]
  );
  const admin = rows[0];
  if (!admin) {
    res.status(404).json({ error: "Admin not found." });
    return;
  }

  res.status(200).json(admin);
}

async function handlePatch(req, res) {
  await ensureAdminActionsTables();
  const payload = requireSuperAdmin(req, res);
  if (!payload) return;

  const { id } = req.query;
  const { firstName, lastName, email, phone, role } = req.body || {};

  if (role && !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: "Invalid role." });
    return;
  }

  const { rows } = await query(
    "select id, email, first_name, last_name, phone, role, name from admins where id = ?",
    [id]
  );
  const current = rows[0];
  if (!current) {
    res.status(404).json({ error: "Admin not found." });
    return;
  }

  const newRole = role || current.role;
  if (current.role === ROLE_SUPER_ADMIN && newRole !== ROLE_SUPER_ADMIN) {
    const { rows: countRows } = await query(
      "select COUNT(*) as cnt from admins where role = ?",
      [ROLE_SUPER_ADMIN]
    );
    if (countRows[0].cnt <= 1) {
      res.status(409).json({ error: "Cannot demote the last super-admin." });
      return;
    }
  }

  const newFirstName = firstName !== undefined ? firstName : current.first_name || "";
  const newLastName = lastName !== undefined ? lastName : current.last_name || "";
  const newEmail = email !== undefined ? email.trim() : current.email || "";
  const newPhone = phone !== undefined ? phone.trim() : current.phone || "";
  const newName = `${newFirstName} ${newLastName}`.trim();

  const actionId = crypto.randomUUID();
  await withTransaction(async (connQuery) => {
    await connQuery(
      `update admins
       set first_name = ?, last_name = ?, email = ?, phone = ?, role = ?, name = ?
       where id = ?`,
      [newFirstName, newLastName, newEmail || null, newPhone || null, newRole, newName, id]
    );
    await connQuery(
      "INSERT INTO admin_actions (id, admin_email, action, details) VALUES (?, ?, ?, ?)",
      [
        actionId,
        payload.email,
        "modify_admin",
        JSON.stringify({
          adminId: id,
          before: {
            firstName: current.first_name,
            lastName: current.last_name,
            email: current.email,
            phone: current.phone,
            role: current.role,
          },
          after: {
            firstName: newFirstName,
            lastName: newLastName,
            email: newEmail,
            phone: newPhone,
            role: newRole,
          },
        }),
      ]
    );
  });

  res.status(200).json({ ok: true });
}

async function handleDelete(req, res) {
  await ensureAdminActionsTables();
  const payload = requireAdmin(req, res);
  if (!payload) return;

  const { id } = req.query;

  const { rows } = await query(
    "select id, email, name, role from admins where id = ?",
    [id]
  );
  const target = rows[0];
  if (!target) {
    res.status(404).json({ error: "Admin not found." });
    return;
  }

  if (target.email === payload.email) {
    res.status(403).json({ error: "Cannot revoke your own admin access." });
    return;
  }

  if (target.role === ROLE_SUPER_ADMIN) {
    const { rows: countRows } = await query(
      "select COUNT(*) as cnt from admins where role = ?",
      [ROLE_SUPER_ADMIN]
    );
    if (countRows[0].cnt <= 1) {
      res.status(409).json({ error: "Cannot revoke the last super-admin." });
      return;
    }
  }

  const actionId = crypto.randomUUID();
  await withTransaction(async (connQuery) => {
    await connQuery("DELETE FROM admin_password_resets WHERE admin_id = ?", [id]);
    await connQuery("DELETE FROM admins WHERE id = ?", [id]);
    await connQuery(
      "INSERT INTO admin_actions (id, admin_email, action, details) VALUES (?, ?, ?, ?)",
      [
        actionId,
        payload.email,
        "revoke_admin",
        JSON.stringify({
          revokedEmail: target.email,
          revokedRole: target.role,
          revokedName: target.name,
        }),
      ]
    );
  });

  res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (!ALLOWED_METHODS.includes(req.method)) {
    methodNotAllowed(req, res, ALLOWED_METHODS);
    return;
  }

  try {
    if (req.method === "GET") {
      await handleGet(req, res);
    } else if (req.method === "PATCH") {
      await handlePatch(req, res);
    } else if (req.method === "DELETE") {
      await handleDelete(req, res);
    }
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
