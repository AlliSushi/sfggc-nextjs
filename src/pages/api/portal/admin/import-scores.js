import {
  validateColumns,
  pivotRowsByBowler,
  matchParticipants,
  importScores,
  detectCsvEventType,
} from "../../../../utils/portal/importScoresCsv.js";
import { query, withTransaction } from "../../../../utils/portal/db.js";
import { logAdminAction } from "../../../../utils/portal/audit.js";
import {
  handleAdminCsvImport,
  NO_PARTICIPANTS_MATCHED_ERROR,
  isNoParticipantsMatchedError,
  parseCsvTextBody,
} from "../../../../utils/portal/import-api.js";
import { IMPORT_MODES } from "../../../../utils/portal/import-constants.js";
import { EVENT_TYPE_LIST } from "../../../../utils/portal/event-constants.js";

export default async function handler(req, res) {
  await handleAdminCsvImport({
    req,
    res,
    parseBody: (body) => {
      const parsed = parseCsvTextBody(body);
      if (parsed.error) return parsed;
      if (!EVENT_TYPE_LIST.includes(body.eventType)) {
        return { error: 'eventType must be "team", "doubles", or "singles".' };
      }
      return { ...parsed, mode: body.mode, eventType: body.eventType };
    },
    validateColumns,
    buildPreview: async ({ rows, payload }) => {
      const csvEventType = detectCsvEventType(rows);
      if (csvEventType && csvEventType !== payload.eventType) {
        throw new Error(
          `event_type_mismatch: CSV contains ${csvEventType} scores but you selected ${payload.eventType}. Please select the correct event type.`
        );
      }
      const bowlerMap = pivotRowsByBowler(rows);
      return matchParticipants(bowlerMap, query, payload.eventType);
    },
    runImport: async ({ preview, payload, adminSession }) => {
      if (payload.mode !== IMPORT_MODES.IMPORT) return null;
      if (preview.matched.length === 0) {
        throw new Error(NO_PARTICIPANTS_MATCHED_ERROR);
      }
      const missingPartners = preview.warnings.filter((w) => w.type === "no_doubles_partner");
      if (missingPartners.length > 0) {
        throw new Error(
          `Cannot import doubles scores: ${missingPartners.length} bowler(s) have no doubles partner assigned. Assign partners before importing.`
        );
      }
      return withTransaction(async (connQuery) => {
        const result = await importScores(
          preview.matched,
          payload.eventType,
          adminSession.email,
          connQuery
        );
        await logAdminAction(
          adminSession.email,
          "import_scores",
          { ...result, eventType: payload.eventType },
          connQuery
        );
        return result;
      });
    },
    onError: (error) => {
      if (
        isNoParticipantsMatchedError(error) ||
        error?.message?.startsWith("Cannot import doubles scores:") ||
        error?.message?.startsWith("event_type_mismatch:")
      ) {
        res.status(400).json({ error: error.message });
        return true;
      }
      console.error("[import-scores]", error);
      return false;
    },
    importErrorMessage: "Score import failed.",
  });
}
