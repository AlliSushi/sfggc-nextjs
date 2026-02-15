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
  matchOptionalEventsParticipants,
} from "../../../../../utils/portal/importOptionalEventsCsv.js";
import {
  getOptionalEventsColumnSupport,
  tryEnsureOptionalEventsColumns,
} from "../../../../../utils/portal/optional-events-db.js";

const buildOptionalEventsColumnExpressions = (columnSupport) => {
  const optionalEventsExpr = columnSupport.optional_events ? "coalesce(optional_events, 0)" : "0";
  const best3Expr = columnSupport.optional_best_3_of_9
    ? "coalesce(optional_best_3_of_9, 0)"
    : optionalEventsExpr;
  const scratchExpr = columnSupport.optional_scratch
    ? "coalesce(optional_scratch, 0)"
    : optionalEventsExpr;
  const allHdcpExpr = columnSupport.optional_all_events_hdcp
    ? "coalesce(optional_all_events_hdcp, 0)"
    : optionalEventsExpr;
  return { optionalEventsExpr, best3Expr, scratchExpr, allHdcpExpr };
};

const fetchPeople = async (columnSupport) => {
  const { optionalEventsExpr, best3Expr, scratchExpr, allHdcpExpr } =
    buildOptionalEventsColumnExpressions(columnSupport);

  const { rows } = await query(
    `
    select pid, first_name, last_name,
           ${optionalEventsExpr} as optional_events,
           ${best3Expr} as optional_best_3_of_9,
           ${scratchExpr} as optional_scratch,
           ${allHdcpExpr} as optional_all_events_hdcp
    from people
    order by last_name, first_name
    `
  );
  return rows;
};

const isOptionalEventsImportClientError = (error) => {
  if (isNoParticipantsMatchedError(error)) {
    return true;
  }

  const message = String(error?.message || "");
  return (
    message.startsWith("Missing required columns:") ||
    message.includes("conflicting duplicate rows; import blocked.")
  );
};

const safeLogOptionalEventsImportAction = async (
  adminEmail,
  details,
  connQuery,
  actionLogger = logAdminAction
) => {
  try {
    await actionLogger(
      adminEmail,
      "import_optional_events",
      details,
      connQuery
    );
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // Keep import writes non-blocking if audit logging is unavailable.
      console.warn("[optional-events] failed to write admin action audit log", error?.message || error);
    }
    return false;
  }
};

const applyOptionalEventsUpdates = async (updates, connQuery, columnSupport) => {
  const {
    optionalEventsExpr: currentOptionalEventsExpr,
    best3Expr: currentBest3Expr,
    scratchExpr: currentScratchExpr,
    allHdcpExpr: currentAllHdcpExpr,
  } = buildOptionalEventsColumnExpressions(columnSupport);

  let updated = 0;
  let unchanged = 0;

  for (const row of updates) {
    const { rows } = await connQuery(
      `
      select ${currentOptionalEventsExpr} as optional_events,
             ${currentBest3Expr} as optional_best_3_of_9,
             ${currentScratchExpr} as optional_scratch,
             ${currentAllHdcpExpr} as optional_all_events_hdcp
      from people
      where pid = ?
      limit 1
      `,
      [row.pid]
    );
    const current = rows?.[0] || {};
    const isSame =
      Number(current.optional_best_3_of_9 || 0) === Number(row.optionalBest3Of9 || 0) &&
      Number(current.optional_scratch || 0) === Number(row.optionalScratch || 0) &&
      Number(current.optional_all_events_hdcp || 0) === Number(row.optionalAllEventsHdcp || 0) &&
      Number(current.optional_events || 0) === Number(row.optionalEvents || 0);
    if (isSame) {
      unchanged += 1;
      continue;
    }

    const setClauses = [];
    const params = [];

    if (columnSupport.optional_best_3_of_9) {
      setClauses.push("optional_best_3_of_9 = ?");
      params.push(row.optionalBest3Of9);
    }
    if (columnSupport.optional_scratch) {
      setClauses.push("optional_scratch = ?");
      params.push(row.optionalScratch);
    }
    if (columnSupport.optional_all_events_hdcp) {
      setClauses.push("optional_all_events_hdcp = ?");
      params.push(row.optionalAllEventsHdcp);
    }
    if (columnSupport.optional_events) {
      setClauses.push("optional_events = ?");
      params.push(row.optionalEvents);
    }
    if (columnSupport.updated_at) {
      setClauses.push("updated_at = now()");
    }

    if (setClauses.length === 0) {
      unchanged += 1;
      continue;
    }

    params.push(row.pid);
    await connQuery(
      `update people set ${setClauses.join(", ")} where pid = ?`,
      params
    );
    updated += 1;
  }

  return { updated, unchanged };
};

export default async function handler(req, res) {
  await tryEnsureOptionalEventsColumns();
  const columnSupport = await getOptionalEventsColumnSupport();
  const missingOptionalEventColumns = [
    "optional_best_3_of_9",
    "optional_scratch",
    "optional_all_events_hdcp",
  ].filter((column) => !columnSupport[column]);

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
      const dbPeople = await fetchPeople(columnSupport);
      const preview = await matchOptionalEventsParticipants(rows, dbPeople);
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
      if (missingOptionalEventColumns.length > 0) {
        throw new Error(
          `Optional Events columns missing (${missingOptionalEventColumns.join(", ")}). Run scripts/dev/run-portal-migrations.sh and restart the server.`
        );
      }
      return withTransaction(async (connQuery) => {
        const result = await applyOptionalEventsUpdates(
          preview.updates,
          connQuery,
          columnSupport
        );
        const auditLogged = await safeLogOptionalEventsImportAction(
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
      const statusCode = isOptionalEventsImportClientError(error) ? 400 : 500;
      const fallbackMessage =
        statusCode === 400
          ? "Optional Events import failed."
          : "Optional Events import failed due to a server error.";
      res.status(statusCode).json({ error: error?.message || fallbackMessage });
      return true;
    },
    importErrorMessage: "Optional Events import failed.",
  });
}

export {
  applyOptionalEventsUpdates,
  isOptionalEventsImportClientError,
  safeLogOptionalEventsImportAction,
};
