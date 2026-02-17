import RootLayout from "../../../components/layout/layout";
import Link from "next/link";
import { useRouter } from "next/router";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import TeamProfile from "../../../components/Portal/TeamProfile/TeamProfile";
import AdminMenu from "../../../components/Portal/AdminMenu/AdminMenu";
import useAdminSession from "../../../hooks/portal/useAdminSession.js";
import { buildTeamPageProps } from "../../../utils/portal/team-page-ssr.js";
import { appendFromParam, normalizeQueryValue, resolveBackHref } from "../../../utils/portal/navigation.js";

const TeamPage = ({ team, roster, scoresVisibleToParticipants = false }) => {
  const router = useRouter();
  const { isAdmin, adminRole } = useAdminSession();
  const from = normalizeQueryValue(router.query.from);
  const backHref = resolveBackHref(from, "/portal/admin/dashboard");
  const participantReturnTo = router.asPath || `/portal/team/${team?.slug || ""}`;

  return (
    <div>
      <PortalShell
        title={team?.name || "Team"}
        subtitle="Team roster and doubles pairings."
      >
        <div className="row g-3 mb-3 align-items-end">
          <div className="col-12 col-md-6 d-flex flex-wrap gap-2 align-items-center">
            {isAdmin && (
              <Link className="btn btn-outline-secondary" href={backHref}>
                Back
              </Link>
            )}
            <h3 className="mb-0">{team?.name || "Team"}</h3>
          </div>
          {isAdmin && (
            <div className="col-12 col-md-6 text-md-end">
              <AdminMenu adminRole={adminRole} />
            </div>
          )}
        </div>
        <TeamProfile
          team={team}
          roster={roster}
          isAdmin={isAdmin}
          showStandingsLink={isAdmin || scoresVisibleToParticipants}
          participantReturnTo={participantReturnTo}
          appendFromParam={appendFromParam}
        />
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
