-- MariaDB/MySQL: use varchar for primary/unique keys (TEXT requires key length in InnoDB).

create table if not exists admins (
  id char(36) primary key,
  email varchar(255) unique,
  name text,
  first_name text,
  last_name text,
  phone varchar(64) unique,
  password_hash text,
  role varchar(64) not null default 'super-admin',
  created_at timestamp default current_timestamp
);

create table if not exists teams (
  tnmt_id varchar(64) primary key,
  team_name text not null,
  slug varchar(255) unique
);

create table if not exists people (
  pid varchar(64) primary key,
  first_name text not null,
  last_name text not null,
  nickname text,
  email text,
  phone text,
  birth_month int,
  birth_day int,
  city text,
  region text,
  country text,
  tnmt_id varchar(64) references teams(tnmt_id),
  did varchar(64),
  team_captain boolean default false,
  team_order int,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp
);

create table if not exists doubles_pairs (
  did varchar(64) primary key,
  pid varchar(64) not null references people(pid),
  partner_pid varchar(64) references people(pid),
  partner_first_name text,
  partner_last_name text
);

create table if not exists scores (
  id char(36) primary key,
  pid varchar(64) not null references people(pid),
  event_type varchar(32) not null check (event_type in ('team','doubles','singles')),
  lane text,
  game1 int,
  game2 int,
  game3 int,
  entering_avg int,
  handicap int,
  updated_at timestamp default current_timestamp
);

create unique index if not exists scores_pid_event_unique
  on scores (pid, event_type);

create table if not exists audit_logs (
  id char(36) primary key,
  admin_email varchar(255) not null,
  pid varchar(64) not null references people(pid),
  field varchar(255) not null,
  old_value text,
  new_value text,
  changed_at timestamp default current_timestamp
);

create table if not exists participant_login_tokens (
  token varchar(512) primary key,
  pid varchar(64) not null references people(pid),
  expires_at timestamp not null,
  used_at timestamp,
  created_at timestamp default current_timestamp
);

create table if not exists admin_actions (
  id char(36) primary key,
  admin_email varchar(255) not null,
  action varchar(255) not null,
  details text,
  created_at timestamp default current_timestamp
);

create table if not exists admin_password_resets (
  id char(36) primary key,
  admin_id char(36) not null references admins(id),
  token varchar(255) not null unique,
  expires_at timestamp not null,
  used_at timestamp,
  created_at timestamp default current_timestamp
);

create table if not exists email_templates (
  id char(36) primary key,
  slug varchar(128) not null unique,
  name varchar(255) not null,
  subject text not null,
  greeting text,
  body text,
  button_text text,
  footer text,
  html_override text,
  use_html_override boolean default false,
  available_variables text,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp
);
