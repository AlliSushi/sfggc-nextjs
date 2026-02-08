import { getAuthSessions } from "./auth-guards.js";
import { buildBaseUrl } from "./ssr-helpers.js";

const buildTeamPageProps = async ({ params, req, fetcher = fetch }) => {
  const { adminSession, participantSession } = getAuthSessions(req);
  if (!adminSession && !participantSession) {
    return {
      redirect: {
        destination: "/portal/participant",
        permanent: false,
      },
    };
  }

  const baseUrl = buildBaseUrl(req);

  const response = await fetcher(
    `${baseUrl}/api/portal/teams/${encodeURIComponent(params.teamSlug)}`,
    {
      headers: {
        cookie: req.headers.cookie || "",
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return {
        redirect: {
          destination: "/portal/participant",
          permanent: false,
        },
      };
    }
    return { notFound: true };
  }

  const data = await response.json();
  return {
    props: {
      team: data.team,
      roster: data.roster,
    },
  };
};

export { buildTeamPageProps };
