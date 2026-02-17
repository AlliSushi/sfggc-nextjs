import { ensureAdminActionsTables } from "../../../../../utils/portal/admins-server.js";
import { handleSuperAdminClear } from "../../../../../utils/portal/admin-clear-route.js";

export default async function handler(req, res) {
  await handleSuperAdminClear({
    req,
    res,
    ensureBeforeClear: ensureAdminActionsTables,
    clearWithQuery: async (connQuery) => {
      await connQuery("delete from audit_logs");
      await connQuery("delete from admin_actions");
    },
    action: "clear_audit_log",
    details: { scope: "global" },
  });
}
