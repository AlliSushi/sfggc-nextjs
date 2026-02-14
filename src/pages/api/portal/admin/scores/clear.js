import { handleSuperAdminClear } from "../../../../../utils/portal/admin-clear-route.js";

export default async function handler(req, res) {
  await handleSuperAdminClear({
    req,
    res,
    clearWithQuery: async (connQuery) => {
      await connQuery("update scores set game1 = null, game2 = null, game3 = null");
    },
    action: "clear_scores",
    details: { scope: "all" },
  });
}
