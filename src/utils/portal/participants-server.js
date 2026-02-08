import { query } from "./db.js";

const PARTICIPANT_LOGIN_TOKENS_TABLE = "participant_login_tokens";

const ensureParticipantLoginTokens = async () => {
  await query(
    `
    create table if not exists ${PARTICIPANT_LOGIN_TOKENS_TABLE} (
      token text primary key,
      pid text not null references people(pid),
      expires_at timestamp not null,
      used_at timestamp,
      created_at timestamp default current_timestamp
    )
    `
  );
};

export { PARTICIPANT_LOGIN_TOKENS_TABLE, ensureParticipantLoginTokens };
