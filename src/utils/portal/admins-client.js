export const resolveAdminLookupStep = ({ admin, participant }) => {
  if (admin) return "existing-admin";
  if (participant) return "participant";
  return "create";
};

export const buildAdminPrefill = (lookupValue) => {
  const trimmed = (lookupValue || "").trim();
  if (!trimmed) {
    return { email: "", phone: "" };
  }
  if (trimmed.includes("@")) {
    return { email: trimmed, phone: "" };
  }
  return { email: "", phone: trimmed };
};
