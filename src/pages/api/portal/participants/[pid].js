import { writeAuditEntries } from "../../../../utils/portal/audit.js";
import { withTransaction } from "../../../../utils/portal/db.js";
import { requireParticipantMatchOrAdmin } from "../../../../utils/portal/auth-guards.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import {
  formatParticipant,
  buildChanges,
  resolveParticipantUpdates,
  applyParticipantUpdates,
} from "../../../../utils/portal/participant-db.js";

const resolveAdminEmail = (sessions) =>
  sessions.adminSession?.email ||
  (sessions.participantSession?.pid
    ? `participant:${sessions.participantSession.pid}`
    : null) ||
  process.env.ADMIN_EMAIL ||
  "admin@local";

const handleGet = async (req, res, pid) => {
  const sessions = requireParticipantMatchOrAdmin(req, res, pid);
  if (!sessions) return;

  const participant = await formatParticipant(pid);
  if (!participant) {
    res.status(404).json({ error: "Participant not found." });
    return;
  }
  res.status(200).json(participant);
};

const handlePatch = async (req, res, pid) => {
  const sessions = requireParticipantMatchOrAdmin(req, res, pid);
  if (!sessions) return;

  const current = await formatParticipant(pid);
  if (!current) {
    res.status(404).json({ error: "Participant not found." });
    return;
  }

  const rawUpdates = req.body || {};
  const isParticipantOnly = Boolean(
    sessions.participantSession && !sessions.adminSession
  );
  const updates = resolveParticipantUpdates(current, rawUpdates, isParticipantOnly);
  const adminEmail = resolveAdminEmail(sessions);

  await withTransaction(async (query) => {
    await applyParticipantUpdates({ pid, updates, isParticipantOnly, query });
    const changes = buildChanges(current, updates);
    await writeAuditEntries(adminEmail, pid, changes, query);
  });

  const updated = await formatParticipant(pid);
  res.status(200).json(updated);
};

export default async function handler(req, res) {
  const { pid } = req.query;

  try {
    if (req.method === "GET") {
      await handleGet(req, res, pid);
      return;
    }

    if (req.method === "PATCH") {
      await handlePatch(req, res, pid);
      return;
    }

    methodNotAllowed(req, res, ["GET", "PATCH"]);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Unexpected error.",
    });
  }
}
