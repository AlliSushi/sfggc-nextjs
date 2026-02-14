import { handleSuperAdminClear } from "../../../../../utils/portal/admin-clear-route.js";

export default async function handler(req, res) {
  await handleSuperAdminClear({
    req,
    res,
    clearWithQuery: async (connQuery) => {
      await connQuery("delete from scores");
    },
    action: "clear_scores",
    details: { scope: "all" },
  });
}
