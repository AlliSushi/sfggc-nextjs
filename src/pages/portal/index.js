import RootLayout from "../../components/layout/layout";
import PortalShell from "../../components/Portal/PortalShell/PortalShell";
import RoleChooser from "../../components/Portal/RoleChooser/RoleChooser";
import {
  COOKIE_ADMIN,
  parseCookies,
  verifyToken,
  getParticipantSession,
} from "../../utils/portal/session.js";

const PortalHome = () => {
  return (
    <div>
      <PortalShell title="Tournament Portal">
        <RoleChooser />
      </PortalShell>
    </div>
  );
};

PortalHome.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export const getServerSideProps = async ({ req }) => {
  try {
    const cookies = parseCookies(req.headers.cookie || "");
    const adminToken = cookies[COOKIE_ADMIN];
    const adminPayload = verifyToken(adminToken);
    if (adminPayload) {
      return {
        redirect: {
          destination: "/portal/admin/dashboard",
          permanent: false,
        },
      };
    }

    const participantSession = getParticipantSession(req.headers.cookie || "");
    if (participantSession?.pid) {
      return {
        redirect: {
          destination: `/portal/participant/${participantSession.pid}`,
          permanent: false,
        },
      };
    }
  } catch (error) {
    // ignore session errors and render portal home
  }

  return { props: {} };
};

export default PortalHome;
