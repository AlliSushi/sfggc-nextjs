import { query as defaultQuery } from "./db.js";

const SETTING_KEYS = {
  PARTICIPANTS_CAN_VIEW_SCORES: "participants_can_view_scores",
  PARTICIPANTS_CAN_VIEW_SCRATCH_MASTERS: "participants_can_view_scratch_masters",
  PARTICIPANTS_CAN_VIEW_OPTIONAL_EVENTS: "participants_can_view_optional_events",
};

const ensurePortalSettingsTable = async (q = defaultQuery) => {
  await q(`
    create table if not exists portal_settings (
      setting_key varchar(128) primary key,
      setting_value text not null,
      updated_at timestamp default current_timestamp on update current_timestamp
    )
  `);
};

const normalizeBooleanSetting = (value, fallback = false) => {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
};

const getSettingValue = async (settingKey, fallbackValue, q = defaultQuery) => {
  await ensurePortalSettingsTable(q);
  const { rows } = await q(
    "select setting_value from portal_settings where setting_key = ? limit 1",
    [settingKey]
  );
  if (!rows?.length) return fallbackValue;
  return rows[0].setting_value;
};

const setSettingValue = async (settingKey, settingValue, q = defaultQuery) => {
  await ensurePortalSettingsTable(q);
  await q(
    `
    insert into portal_settings (setting_key, setting_value)
    values (?, ?)
    on duplicate key update
      setting_value = values(setting_value),
      updated_at = now()
    `,
    [settingKey, String(settingValue)]
  );
};

const getBooleanSetting = async (settingKey, fallback = false, q = defaultQuery) => {
  const rawValue = await getSettingValue(settingKey, fallback ? "1" : "0", q);
  return normalizeBooleanSetting(rawValue, fallback);
};

const setBooleanSetting = async (settingKey, enabled, q = defaultQuery) => {
  await setSettingValue(settingKey, enabled ? "1" : "0", q);
};

const getScoresVisibleToParticipants = async (q = defaultQuery) =>
  getBooleanSetting(SETTING_KEYS.PARTICIPANTS_CAN_VIEW_SCORES, false, q);

const setScoresVisibleToParticipants = async (enabled, q = defaultQuery) =>
  setBooleanSetting(SETTING_KEYS.PARTICIPANTS_CAN_VIEW_SCORES, enabled, q);

const getScratchMastersVisibleToParticipants = async (q = defaultQuery) =>
  getBooleanSetting(SETTING_KEYS.PARTICIPANTS_CAN_VIEW_SCRATCH_MASTERS, false, q);

const setScratchMastersVisibleToParticipants = async (enabled, q = defaultQuery) =>
  setBooleanSetting(SETTING_KEYS.PARTICIPANTS_CAN_VIEW_SCRATCH_MASTERS, enabled, q);

const getOptionalEventsVisibleToParticipants = async (q = defaultQuery) =>
  getBooleanSetting(SETTING_KEYS.PARTICIPANTS_CAN_VIEW_OPTIONAL_EVENTS, false, q);

const setOptionalEventsVisibleToParticipants = async (enabled, q = defaultQuery) =>
  setBooleanSetting(SETTING_KEYS.PARTICIPANTS_CAN_VIEW_OPTIONAL_EVENTS, enabled, q);

export {
  SETTING_KEYS,
  ensurePortalSettingsTable,
  normalizeBooleanSetting,
  getSettingValue,
  setSettingValue,
  getBooleanSetting,
  setBooleanSetting,
  getScoresVisibleToParticipants,
  setScoresVisibleToParticipants,
  getScratchMastersVisibleToParticipants,
  setScratchMastersVisibleToParticipants,
  getOptionalEventsVisibleToParticipants,
  setOptionalEventsVisibleToParticipants,
};
