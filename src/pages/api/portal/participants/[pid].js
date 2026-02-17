import { writeAuditEntries } from "../../../../utils/portal/audit.js";
import { withTransaction } from "../../../../utils/portal/db.js";
import {
  requireAnySession,
  requireParticipantMatchOrAdmin,
} from "../../../../utils/portal/auth-guards.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import {
  formatParticipant,
  buildChanges,
  resolveParticipantUpdates,
  applyParticipantUpdates,
  checkPartnerConflict,
  upsertReciprocalPartner,
} from "../../../../utils/portal/participant-db.js";

const resolveAdminEmail = (sessions) =>
  sessions.adminSession?.email ||
  (sessions.participantSession?.pid
    ? `participant:${sessions.participantSession.pid}`
    : null) ||
  process.env.ADMIN_EMAIL ||
  "admin@local";

const handleGet = async (req, res, pid) => {
  const sessions = await requireAnySession(req, res);
  if (!sessions) return;

  const participant = await formatParticipant(pid);
  if (!participant) {
    res.status(404).json({ error: "Participant not found." });
    return;
  }
  res.status(200).json(participant);
};

const handlePatch = async (req, res, pid) => {
  const sessions = await requireParticipantMatchOrAdmin(req, res, pid);
  if (!sessions) return;

  const current = await formatParticipant(pid);
  if (!current) {
    res.status(404).json({ error: "Participant not found." });
    return;
  }

  const rawUpdates = req.body || {};
  const forceReciprocal = rawUpdates.forceReciprocal === true;
  const isParticipantOnly = Boolean(
    sessions.participantSession && !sessions.adminSession
  );
  const updates = resolveParticipantUpdates(current, rawUpdates, isParticipantOnly);
  const adminEmail = resolveAdminEmail(sessions);

  // Detect partner change (admin-only, non-empty new partner)
  const partnerChanged = !isParticipantOnly &&
    updates.doubles?.partnerPid &&
    updates.doubles.partnerPid !== current.doubles?.partnerPid;

  // Check for conflict before committing
  if (partnerChanged && !forceReciprocal) {
    const conflict = await checkPartnerConflict(updates.doubles.partnerPid, pid);
    if (conflict) {
      res.status(409).json({ conflict });
      return;
    }
  }

  await withTransaction(async (query) => {
    await applyParticipantUpdates({ pid, updates, isParticipantOnly, query });
    const changes = buildChanges(current, updates);
    await writeAuditEntries(adminEmail, pid, changes, query);

    // Auto-reciprocate when partner changed
    if (partnerChanged) {
      const partnerCurrent = await formatParticipant(updates.doubles.partnerPid, query);
      const oldPartnerPid = partnerCurrent?.doubles?.partnerPid || "";

      await upsertReciprocalPartner(updates.doubles.partnerPid, pid, query);

      // Audit the reciprocal change for the partner
      if (oldPartnerPid !== pid) {
        const reciprocalChanges = [
          { field: "partner_pid", oldValue: oldPartnerPid, newValue: pid },
        ];
        await writeAuditEntries(adminEmail, updates.doubles.partnerPid, reciprocalChanges, query);
      }
    }
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
