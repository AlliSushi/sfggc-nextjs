import { query as defaultQuery } from "./db.js";

const OPTIONAL_EVENT_COLUMNS = [
  "optional_events",
  "optional_best_3_of_9",
  "optional_scratch",
  "optional_all_events_hdcp",
  "updated_at",
];

const getOptionalEventsColumnSupport = async (q = defaultQuery) => {
  const { rows } = await q(
    `
    select column_name
    from information_schema.columns
    where table_schema = database()
      and table_name = 'people'
      and column_name in (?, ?, ?, ?, ?)
    `,
    OPTIONAL_EVENT_COLUMNS
  );

  const present = new Set((rows || []).map((row) => row.column_name));
  return {
    optional_events: present.has("optional_events"),
    optional_best_3_of_9: present.has("optional_best_3_of_9"),
    optional_scratch: present.has("optional_scratch"),
    optional_all_events_hdcp: present.has("optional_all_events_hdcp"),
    updated_at: present.has("updated_at"),
  };
};

const tryEnsureOptionalEventsColumns = async (q = defaultQuery) => {
  try {
    await q(
      `
      alter table people
        add column if not exists optional_events tinyint(1) not null default 0,
        add column if not exists optional_best_3_of_9 tinyint(1) not null default 0,
        add column if not exists optional_scratch tinyint(1) not null default 0,
        add column if not exists optional_all_events_hdcp tinyint(1) not null default 0
      `
    );
  } catch {
    // Best-effort migration safety; routes will still fallback when columns are unavailable.
  }
};

export { getOptionalEventsColumnSupport, tryEnsureOptionalEventsColumns };
