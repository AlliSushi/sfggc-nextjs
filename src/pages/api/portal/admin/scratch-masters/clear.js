import { handleSuperAdminClear } from "../../../../../utils/portal/admin-clear-route.js";

export default async function handler(req, res) {
  await handleSuperAdminClear({
    req,
    res,
    clearWithQuery: async (connQuery) => {
      await connQuery("update people set scratch_masters = 0");
    },
    action: "clear_scratch_masters",
    details: { scope: "all" },
  });
}
