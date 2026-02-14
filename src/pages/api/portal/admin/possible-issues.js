import { query } from "../../../../utils/portal/db.js";
import { requireAdmin } from "../../../../utils/portal/auth-guards.js";
import { methodNotAllowed } from "../../../../utils/portal/http.js";
import { buildPossibleIssuesReport } from "../../../../utils/portal/possible-issues.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      methodNotAllowed(req, res, ["GET"]);
      return;
    }

    const adminSession = await requireAdmin(req, res);
    if (!adminSession) {
      return;
    }

    const report = await buildPossibleIssuesReport(query);
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ error: "Unable to load possible issues." });
  }
}
