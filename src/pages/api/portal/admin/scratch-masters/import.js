import { query, withTransaction } from "../../../../../utils/portal/db.js";
import { logAdminAction } from "../../../../../utils/portal/audit.js";
import {
  handleAdminCsvImport,
  isNoParticipantsMatchedError,
  parseCsvTextBody,
} from "../../../../../utils/portal/import-api.js";
import { IMPORT_MODES } from "../../../../../utils/portal/import-constants.js";
import {
  validateColumns,
  matchScratchMastersParticipants,
} from "../../../../../utils/portal/importScratchMastersCsv.js";

const fetchPeople = async () => {
  const { rows } = await query(
    `
    select pid, first_name, last_name, nickname, scratch_masters
    from people
    order by last_name, first_name
    `
  );
  return rows;
};

const isScratchMastersImportClientError = (error) => {
  if (isNoParticipantsMatchedError(error)) {
    return true;
  }

  const message = String(error?.message || "");
  return (
    message.startsWith("Missing required columns:") ||
    message.includes("conflicting duplicate rows; import blocked.") ||
    message.includes("invalid SM? value; expected 0 or 1.")
  );
};

const safeLogScratchMastersImportAction = async (
  adminEmail,
  details,
  connQuery,
  actionLogger = logAdminAction
) => {
  try {
    await actionLogger(
      adminEmail,
      "import_scratch_masters",
      details,
      connQuery
    );
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[scratch-masters] failed to write admin action audit log", error?.message || error);
    }
    return false;
  }
};

const applyScratchMastersUpdates = async (updates, connQuery) => {
  let updated = 0;
  let unchanged = 0;

  for (const row of updates) {
    const { rows } = await connQuery("select scratch_masters from people where pid = ? limit 1", [row.pid]);
    const current = rows?.[0]?.scratch_masters ? 1 : 0;
    if (current === row.scratchMasters) {
      unchanged += 1;
      continue;
    }

    await connQuery(
      `update people set scratch_masters = ?, updated_at = now() where pid = ?`,
      [row.scratchMasters, row.pid]
    );
    updated += 1;
  }

  return { updated, unchanged };
};

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
    buildPreview: async ({ rows }) => {
      const dbPeople = await fetchPeople();
      const preview = await matchScratchMastersParticipants(rows, dbPeople);
      if (preview.errors.length > 0) {
        throw new Error(preview.errors.join(" "));
      }
      return preview;
    },
    runImport: async ({ preview, payload, adminSession }) => {
      if (payload.mode !== IMPORT_MODES.IMPORT) return null;
      if (preview.matched.length === 0) {
        throw new Error("No participants matched. Nothing to import.");
      }

      return withTransaction(async (connQuery) => {
        const result = await applyScratchMastersUpdates(preview.updates, connQuery);
        const auditLogged = await safeLogScratchMastersImportAction(
          adminSession.email,
          {
            matched: preview.matched.length,
            unmatched: preview.unmatched.length,
            warnings: preview.warnings.length,
            ...result,
          },
          connQuery
        );
        return { ...result, auditLogged };
      });
    },
    onError: (error) => {
      const statusCode = isScratchMastersImportClientError(error) ? 400 : 500;
      const fallbackMessage =
        statusCode === 400
          ? "Scratch Masters import failed."
          : "Scratch Masters import failed due to a server error.";
      res.status(statusCode).json({ error: error?.message || fallbackMessage });
      return true;
    },
    importErrorMessage: "Scratch Masters import failed.",
  });
}

export { isScratchMastersImportClientError, safeLogScratchMastersImportAction };
