const startParticipantAuth = ({ emailOrPhone }) => {
  return {
    ok: true,
    message:
      "If that email or phone is registered, a link has been sent.",
    request: emailOrPhone,
  };
};

const startAdminAuth = ({ accessToken }) => {
  return {
    ok: true,
    role: "super-admin",
    token: accessToken ? "verified" : "unverified",
  };
};

export { startParticipantAuth, startAdminAuth };
