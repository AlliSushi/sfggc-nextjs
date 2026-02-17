import { requireSuperAdmin } from "../../../../utils/portal/auth-guards.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import {
  initializeEmailTemplates,
  getAllTemplates,
} from "../../../../utils/portal/email-templates-db.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      methodNotAllowed(req, res, ["GET"]);
      return;
    }

    const payload = await requireSuperAdmin(req, res);
    if (!payload) return;

    await initializeEmailTemplates();

    const templates = await getAllTemplates();
    res.status(200).json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
