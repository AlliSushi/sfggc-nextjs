import fs from "fs";
import { IncomingForm } from "formidable";
import { importIgboXml } from "../../../../utils/portal/importIgboXml.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import { requireSuperAdmin } from "../../../../utils/portal/auth-guards.js";
import { logAdminAction } from "../../../../utils/portal/audit.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const readFile = (file) => fs.readFileSync(file.filepath || file.path, "utf8");

const IMPORT_XML_MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMPORT_XML_MAX_FIELDS = 20;
const IMPORT_XML_MAX_FIELDS_SIZE = 512 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(req, res, ["POST"]);
    return;
  }

  const adminSession = await requireSuperAdmin(req, res);
  if (!adminSession) return;

  const form = new IncomingForm({
    maxFileSize: IMPORT_XML_MAX_FILE_SIZE,
    maxFields: IMPORT_XML_MAX_FIELDS,
    maxFieldsSize: IMPORT_XML_MAX_FIELDS_SIZE,
    allowEmptyFiles: false,
  });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(400).json({ error: "Unable to parse upload." });
      return;
    }

    const file = files?.xml;
    if (!file) {
      res.status(400).json({ error: "XML file is required." });
      return;
    }

    try {
      const fileEntry = Array.isArray(file) ? file[0] : file;
      const filename = (fileEntry.originalFilename || fileEntry.name || "").toLowerCase();
      if (filename && !filename.endsWith(".xml")) {
        res.status(400).json({ error: "Only .xml files are allowed." });
        return;
      }
      if (fileEntry.mimetype && !fileEntry.mimetype.includes("xml")) {
        res.status(400).json({ error: "Unsupported file type." });
        return;
      }

      const xmlText = readFile(fileEntry);
      const summary = await importIgboXml(xmlText);
      await logAdminAction(adminSession.email, "import_xml", summary);
      res.status(200).json({ ok: true, summary });
    } catch (error) {
      res.status(500).json({ error: error.message || "Import failed." });
    }
  });
}
