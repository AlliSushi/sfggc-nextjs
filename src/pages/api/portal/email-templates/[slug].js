import { requireSuperAdmin } from "../../../../utils/portal/auth-guards.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import {
  initializeEmailTemplates,
  getTemplateBySlug,
  upsertTemplate,
} from "../../../../utils/portal/email-templates-db.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "PUT") {
      methodNotAllowed(req, res, ["GET", "PUT"]);
      return;
    }

    const payload = await requireSuperAdmin(req, res);
    if (!payload) return;

    await initializeEmailTemplates();

    const { slug } = req.query;

    if (req.method === "GET") {
      const template = await getTemplateBySlug(slug);
      if (!template) {
        res.status(404).json({ error: "Template not found." });
        return;
      }
      res.status(200).json(template);
      return;
    }

    const body = req.body || {};
    if (!body.subject) {
      res.status(400).json({ error: "Subject is required." });
      return;
    }

    await upsertTemplate({ slug, ...body });
    const updated = await getTemplateBySlug(slug);
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
}
