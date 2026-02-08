import {
  COOKIE_ADMIN,
  COOKIE_PARTICIPANT,
  parseCookies,
  verifyToken,
} from "./session.js";
import { buildBaseUrl } from "./ssr-helpers.js";

const buildParticipantPageProps = async ({ params, req, fetcher = fetch }) => {
  try {
    const cookies = parseCookies(req.headers.cookie || "");
    const participantToken = verifyToken(cookies[COOKIE_PARTICIPANT]);
    const adminToken = verifyToken(cookies[COOKIE_ADMIN]);
    if (!participantToken && !adminToken) {
      return {
        redirect: {
          destination: "/portal/participant",
          permanent: false,
        },
      };
    }
  } catch (error) {
    return {
      redirect: {
        destination: "/portal/participant",
        permanent: false,
      },
    };
  }

  const baseUrl = buildBaseUrl(req);

  const response = await fetcher(
    `${baseUrl}/api/portal/participants/${encodeURIComponent(params.pid)}`,
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

  const participant = await response.json();
  return {
    props: {
      participant,
    },
  };
};

export { buildParticipantPageProps };
