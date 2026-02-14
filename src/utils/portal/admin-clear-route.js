import { withTransaction } from "./db.js";
import { methodNotAllowed } from "./http.js";
import { requireSuperAdmin } from "./auth-guards.js";
import { logAdminAction } from "./audit.js";

const handleSuperAdminClear = async ({
  req,
  res,
  clearWithQuery,
  action,
  details,
  ensureBeforeClear,
}) => {
  if (req.method !== "POST") {
    methodNotAllowed(req, res, ["POST"]);
    return;
  }

  try {
    const payload = await requireSuperAdmin(req, res);
    if (!payload) return;

    if (ensureBeforeClear) {
      await ensureBeforeClear();
    }

    await withTransaction(async (connQuery) => {
      await clearWithQuery(connQuery);
      await logAdminAction(payload.email, action, details, connQuery);
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected error." });
  }
};

export { handleSuperAdminClear };
