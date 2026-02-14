import { parseCSV } from "../../../../utils/portal/csv.js";
import {
  validateColumns,
  matchParticipants,
  importLanes,
} from "../../../../utils/portal/importLanesCsv.js";
import { query, withTransaction } from "../../../../utils/portal/db.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import { requireSuperAdmin } from "../../../../utils/portal/auth-guards.js";
import { logAdminAction } from "../../../../utils/portal/audit.js";

const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(req, res, ["POST"]);
    return;
  }

  const adminSession = await requireSuperAdmin(req, res);
  if (!adminSession) return;

  const { csvText, mode } = req.body || {};

  if (!csvText || typeof csvText !== "string") {
    res.status(400).json({ error: "csvText is required." });
    return;
  }

  if (Buffer.byteLength(csvText, "utf8") > MAX_CSV_SIZE_BYTES) {
    res.status(413).json({ error: "CSV too large." });
    return;
  }

  if (mode !== "preview" && mode !== "import") {
    res.status(400).json({ error: 'mode must be "preview" or "import".' });
    return;
  }

  try {
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      res.status(400).json({ error: "CSV file is empty or has no data rows." });
      return;
    }

    const headers = Object.keys(rows[0]);
    const { valid, missing } = validateColumns(headers);
    if (!valid) {
      res.status(400).json({ error: `Missing required columns: ${missing.join(", ")}` });
      return;
    }

    const { matched, unmatched } = await matchParticipants(rows, query);

    if (mode === "preview") {
      res.status(200).json({ ok: true, matched, unmatched });
      return;
    }

    if (matched.length === 0) {
      res.status(400).json({ error: "No participants matched. Nothing to import." });
      return;
    }

    const summary = await withTransaction(async (connQuery) => {
      const result = await importLanes(matched, adminSession.email, connQuery);
      await logAdminAction(adminSession.email, "import_lanes", result, connQuery);
      return result;
    });

    res.status(200).json({ ok: true, summary });
  } catch (error) {
    console.error("[import-lanes]", error);
    res.status(500).json({ error: "Lane import failed." });
  }
}
