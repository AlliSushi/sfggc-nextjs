import { parseCSV } from "./csv.js";
import { methodNotAllowed } from "./http.js";
import { requireSuperAdmin } from "./auth-guards.js";
import { MAX_CSV_SIZE_BYTES, IMPORT_MODES, isImportMode } from "./import-constants.js";

const NO_PARTICIPANTS_MATCHED_ERROR = "No participants matched. Nothing to import.";
const isNoParticipantsMatchedError = (error) =>
  error?.message === NO_PARTICIPANTS_MATCHED_ERROR;
const parseCsvTextBody = (body = {}) => {
  if (!body.csvText || typeof body.csvText !== "string") {
    return { error: "csvText is required." };
  }
  return { csvText: body.csvText };
};

const handleAdminCsvImport = async ({
  req,
  res,
  parseBody,
  validateColumns,
  buildPreview,
  runImport,
  onError,
  importErrorMessage = "Import failed.",
}) => {
  if (req.method !== "POST") {
    methodNotAllowed(req, res, ["POST"]);
    return;
  }

  const adminSession = await requireSuperAdmin(req, res);
  if (!adminSession) return;

  const payload = parseBody(req.body || {});
  if (payload.error) {
    res.status(400).json({ error: payload.error });
    return;
  }

  const { csvText, mode } = payload;
  if (Buffer.byteLength(csvText, "utf8") > MAX_CSV_SIZE_BYTES) {
    res.status(413).json({ error: "CSV too large." });
    return;
  }

  if (!isImportMode(mode)) {
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

    const preview = await buildPreview({ rows, payload, adminSession });
    if (mode === IMPORT_MODES.PREVIEW) {
      res.status(200).json({ ok: true, ...preview });
      return;
    }

    const summary = await runImport({ preview, payload, adminSession });
    res.status(200).json({ ok: true, summary });
  } catch (error) {
    const handled = onError?.(error, res);
    if (handled) return;
    res.status(500).json({ error: importErrorMessage });
  }
};

export {
  handleAdminCsvImport,
  NO_PARTICIPANTS_MATCHED_ERROR,
  isNoParticipantsMatchedError,
  parseCsvTextBody,
};
