import {
  validateColumns,
  matchParticipants,
  importLanes,
} from "../../../../utils/portal/importLanesCsv.js";
import { query, withTransaction } from "../../../../utils/portal/db.js";
import { logAdminAction } from "../../../../utils/portal/audit.js";
import {
  handleAdminCsvImport,
  NO_PARTICIPANTS_MATCHED_ERROR,
  isNoParticipantsMatchedError,
  parseCsvTextBody,
} from "../../../../utils/portal/import-api.js";
import { IMPORT_MODES } from "../../../../utils/portal/import-constants.js";

export default async function handler(req, res) {
  await handleAdminCsvImport({
    req,
    res,
    parseBody: (body) => {
      const parsed = parseCsvTextBody(body);
      if (parsed.error) return parsed;
      return { ...parsed, mode: body.mode };
    },
    validateColumns,
    buildPreview: async ({ rows }) => matchParticipants(rows, query),
    runImport: async ({ preview, adminSession, payload }) => {
      if (payload.mode !== IMPORT_MODES.IMPORT) return null;
      if (preview.matched.length === 0) {
        throw new Error(NO_PARTICIPANTS_MATCHED_ERROR);
      }
      return withTransaction(async (connQuery) => {
        const result = await importLanes(preview.matched, adminSession.email, connQuery);
        await logAdminAction(adminSession.email, "import_lanes", result, connQuery);
        return result;
      });
    },
    onError: (error) => {
      if (isNoParticipantsMatchedError(error)) {
        res.status(400).json({ error: error.message });
        return true;
      }
      console.error("[import-lanes]", error);
      return false;
    },
    importErrorMessage: "Lane import failed.",
  });
}
