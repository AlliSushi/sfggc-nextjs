import { getAdminSession, getParticipantSession } from "./session.js";
import { forbidden, unauthorized } from "./http.js";
import { ROLE_SUPER_ADMIN } from "./roles.js";

const getAuthSessions = (req) => {
  const cookieHeader = req.headers.cookie || "";
  const adminSession = getAdminSession(cookieHeader);
  const participantSession = getParticipantSession(cookieHeader);
  return {
    adminSession,
    participantSession,
    hasSession: Boolean(adminSession || participantSession),
  };
};

const requireAdmin = (req, res) => {
  const { adminSession } = getAuthSessions(req);
  if (!adminSession) {
    unauthorized(res);
    return null;
  }
  return adminSession;
};

const requireSuperAdmin = (req, res) => {
  const { adminSession } = getAuthSessions(req);
  if (!adminSession) {
    unauthorized(res);
    return null;
  }
  if (adminSession.role !== ROLE_SUPER_ADMIN) {
    forbidden(res);
    return null;
  }
  return adminSession;
};

const requireParticipantMatchOrAdmin = (req, res, pid) => {
  const { adminSession, participantSession, hasSession } = getAuthSessions(req);
  if (adminSession) {
    return { adminSession, participantSession };
  }
  if (participantSession && participantSession.pid === pid) {
    return { adminSession: null, participantSession };
  }
  if (hasSession) {
    forbidden(res);
    return null;
  }
  unauthorized(res);
  return null;
};

export { getAuthSessions, requireAdmin, requireSuperAdmin, requireParticipantMatchOrAdmin };
