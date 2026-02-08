import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import TeamProfile from "../../../components/Portal/TeamProfile/TeamProfile";
import useAdminSession from "../../../hooks/portal/useAdminSession.js";
import { buildTeamPageProps } from "../../../utils/portal/team-page-ssr.js";

const TeamPage = ({ team, roster }) => {
  const { isAdmin } = useAdminSession();

  return (
    <div>
      <PortalShell
        title={team?.name || "Team"}
        subtitle="Team roster and doubles pairings."
      >
        <TeamProfile team={team} roster={roster} isAdmin={isAdmin} />
      </PortalShell>
    </div>
  );
};

export const getServerSideProps = async ({ params, req }) => {
  return buildTeamPageProps({ params, req });
};

TeamPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default TeamPage;
