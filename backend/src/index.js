import { startAdminAuth, startParticipantAuth } from "./routes/auth.js";
import {
  adminPreviewParticipant,
  getParticipant,
  listParticipants,
  updateParticipant,
} from "./routes/participants.js";
import { importResults } from "./routes/results.js";
import { getAuditLog } from "./routes/admin.js";

const routes = {
  auth: {
    startAdminAuth,
    startParticipantAuth,
  },
  participants: {
    listParticipants,
    getParticipant,
    updateParticipant,
    adminPreviewParticipant,
  },
  results: {
    importResults,
  },
  admin: {
    getAuditLog,
  },
};

export { routes };
