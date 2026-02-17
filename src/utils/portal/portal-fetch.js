const ADMIN_LOGIN = "/portal/";
const PARTICIPANT_LOGIN = "/portal/participant";

const portalFetch = async (url, options, behavior = {}) => {
  const response = await fetch(url, options);
  if (behavior.allowAuthErrorResponses) {
    return response;
  }
  if (response.status === 401 || response.status === 403) {
    const currentPath = window.location.pathname || "";
    const isParticipantPage = currentPath.startsWith("/portal/participant");
    const destination = isParticipantPage ? PARTICIPANT_LOGIN : ADMIN_LOGIN;
    window.location.href = destination;
    return new Promise(() => {});
  }
  return response;
};

export { portalFetch };
