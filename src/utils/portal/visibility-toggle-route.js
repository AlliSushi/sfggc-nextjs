import { methodNotAllowed, internalServerError } from "./http.js";
import { requireAdmin } from "./auth-guards.js";
import { logAdminAction } from "./audit.js";

const createVisibilityToggleHandler = ({
  valueKey,
  getVisibility,
  setVisibility,
  action,
}) =>
  async function visibilityToggleHandler(req, res) {
    try {
      if (req.method === "GET") {
        const value = await getVisibility();
        res.status(200).json({ [valueKey]: value });
        return;
      }

      const adminSession = await requireAdmin(req, res);
      if (!adminSession) return;

      if (req.method === "PUT") {
        if (typeof req.body?.[valueKey] !== "boolean") {
          res.status(400).json({ error: `${valueKey} must be a boolean.` });
          return;
        }

        const value = req.body[valueKey];
        await setVisibility(value);
        await logAdminAction(adminSession.email, action, { [valueKey]: value });
        res.status(200).json({ ok: true, [valueKey]: value });
        return;
      }

      methodNotAllowed(req, res, ["GET", "PUT"]);
    } catch (error) {
      internalServerError(res, error);
    }
  };

export { createVisibilityToggleHandler };
