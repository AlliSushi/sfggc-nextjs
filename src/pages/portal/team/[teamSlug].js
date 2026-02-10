import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import TeamProfile from "../../../components/Portal/TeamProfile/TeamProfile";
import AdminMenu from "../../../components/Portal/AdminMenu/AdminMenu";
import useAdminSession from "../../../hooks/portal/useAdminSession.js";
import { buildTeamPageProps } from "../../../utils/portal/team-page-ssr.js";

const TeamPage = ({ team, roster }) => {
  const { isAdmin, adminRole } = useAdminSession();

  return (
    <div>
      <PortalShell
        title={team?.name || "Team"}
        subtitle="Team roster and doubles pairings."
      >
        <div className="row mb-3">
          <div className="col-12 col-md-6">
            <h3>{team?.name || "Team"}</h3>
          </div>
          {isAdmin && (
            <div className="col-12 col-md-6 text-md-end">
              <AdminMenu adminRole={adminRole} />
            </div>
          )}
        </div>
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
