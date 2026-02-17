import { randomUUID } from "crypto";
import { query as defaultQuery } from "./db.js";

const normalizeValue = (value) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
};

const buildAuditEntries = (adminEmail, pid, changes) => {
  return changes.map((change) => ({
    admin_email: adminEmail,
    pid,
    field: change.field,
    old_value: normalizeValue(change.oldValue),
    new_value: normalizeValue(change.newValue),
  }));
};

const writeAuditEntries = async (adminEmail, pid, changes, query = defaultQuery) => {
  if (!changes.length) {
    return;
  }
  const entries = buildAuditEntries(adminEmail, pid, changes);
  const values = [];
  const params = [];
  entries.forEach((entry) => {
    values.push("(?,?,?,?,?,?)");
    params.push(
      randomUUID(),
      entry.admin_email,
      entry.pid,
      entry.field,
      entry.old_value,
      entry.new_value
    );
  });
  await query(
    `
    insert into audit_logs (id, admin_email, pid, field, old_value, new_value)
    values ${values.join(",")}
    `,
    params
  );
};

const logAdminAction = async (
  adminEmail,
  action,
  details,
  query = defaultQuery
) => {
  await query(
    `
    insert into admin_actions (id, admin_email, action, details)
    values (?,?,?,?)
    `,
    [randomUUID(), adminEmail, action, normalizeValue(details)]
  );
};

export { buildAuditEntries, writeAuditEntries, logAdminAction };
