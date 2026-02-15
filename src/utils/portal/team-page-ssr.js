import { getAuthSessions } from "./auth-guards.js";
import { buildBaseUrl } from "./ssr-helpers.js";
import { getScoresVisibleToParticipants } from "./portal-settings-db.js";

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

  const baseUrl = buildBaseUrl();

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
  const scoresVisibleToParticipants = await getScoresVisibleToParticipants();
  return {
    props: {
      team: data.team,
      roster: data.roster,
      scoresVisibleToParticipants,
    },
  };
};

export { buildTeamPageProps };
