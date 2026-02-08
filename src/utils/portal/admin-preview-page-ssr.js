import { getAdminSession } from "./session.js";
import { buildBaseUrl } from "./ssr-helpers.js";

const buildAdminPreviewPageProps = async ({ params, req, fetcher = fetch }) => {
  const adminSession = getAdminSession(req.headers.cookie || "");
  if (!adminSession) {
    return {
      redirect: {
        destination: "/portal/admin",
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
          destination: "/portal/admin",
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

export { buildAdminPreviewPageProps };
