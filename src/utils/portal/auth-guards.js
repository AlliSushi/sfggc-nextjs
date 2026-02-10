import { getAdminSession, getParticipantSession } from "./session.js";
import { forbidden, unauthorized } from "./http.js";
import { ROLE_SUPER_ADMIN } from "./roles.js";
import { query } from "./db.js";

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

const checkSessionRevocation = async (adminSession) => {
  if (!adminSession || !adminSession.email) {
    return false;
  }

  // Query admin's sessions_revoked_at timestamp
  const { rows } = await query(
    "SELECT sessions_revoked_at FROM admins WHERE email = ? LIMIT 1",
    [adminSession.email]
  );

  if (!rows || rows.length === 0) {
    return false;
  }

  const admin = rows[0];
  const sessionsRevokedAt = admin.sessions_revoked_at;

  // If no revocation timestamp, session is valid
  if (!sessionsRevokedAt) {
    return true;
  }

  // If session was created before revocation, it's invalid
  const sessionCreatedAt = adminSession.iat;
  const revocationTime = new Date(sessionsRevokedAt).getTime();

  if (sessionCreatedAt < revocationTime) {
    return false;
  }

  return true;
};

const requireAdmin = async (req, res) => {
  const { adminSession } = getAuthSessions(req);
  if (!adminSession) {
    unauthorized(res);
    return null;
  }

  // Check if session was revoked
  const isValid = await checkSessionRevocation(adminSession);
  if (!isValid) {
    unauthorized(res);
    return null;
  }

  return adminSession;
};

const requireSuperAdmin = async (req, res) => {
  const { adminSession } = getAuthSessions(req);
  if (!adminSession) {
    unauthorized(res);
    return null;
  }

  // Check if session was revoked
  const isValid = await checkSessionRevocation(adminSession);
  if (!isValid) {
    unauthorized(res);
    return null;
  }

  if (adminSession.role !== ROLE_SUPER_ADMIN) {
    forbidden(res);
    return null;
  }
  return adminSession;
};

const requireParticipantMatchOrAdmin = async (req, res, pid) => {
  const { adminSession, participantSession, hasSession } = getAuthSessions(req);

  if (adminSession) {
    // Check if admin session was revoked
    const isValid = await checkSessionRevocation(adminSession);
    if (!isValid) {
      unauthorized(res);
      return null;
    }
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
