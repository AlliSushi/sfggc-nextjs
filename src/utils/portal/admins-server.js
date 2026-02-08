import { query } from "./db.js";
import { requireSuperAdmin } from "./auth-guards.js";

export const ensureAdminTables = async () => {
  await query(
    `
    create table if not exists admins (
      id char(36) primary key default (uuid()),
      email text unique,
      name text,
      pid text,
      first_name text,
      last_name text,
      phone text unique,
      password_hash text,
      role text not null default 'super-admin',
      created_at timestamp default current_timestamp
    )
    `
  );
  await query("alter table admins modify column email text unique");
  await query("alter table admins add column if not exists first_name text");
  await query("alter table admins add column if not exists last_name text");
  await query("alter table admins add column if not exists phone text");
  await query("alter table admins add column if not exists pid text");
  await query("create index if not exists admins_pid_idx on admins(pid)");
  await query(
    "create unique index if not exists admins_phone_unique_idx on admins(phone)"
  );
};

export const ensureAdminResetTables = async () => {
  await ensureAdminTables();
  await query(
    `
    create table if not exists admin_password_resets (
      id char(36) primary key default (uuid()),
      admin_id char(36) not null references admins(id),
      token text not null unique,
      expires_at timestamp not null,
      used_at timestamp,
      created_at timestamp default current_timestamp
    )
    `
  );
};

export { requireSuperAdmin };
