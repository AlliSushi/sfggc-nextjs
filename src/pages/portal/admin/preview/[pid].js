import Link from "next/link";
import RootLayout from "../../../../components/layout/layout";
import PortalShell from "../../../../components/Portal/PortalShell/PortalShell";
import ParticipantProfile from "../../../../components/Portal/ParticipantProfile/ParticipantProfile";
import { buildAdminPreviewPageProps } from "../../../../utils/portal/admin-preview-page-ssr.js";

const AdminPreviewPage = ({ participant }) => {
  return (
    <div>
      <PortalShell
        title="Participant preview"
        subtitle="You are viewing this participant as an admin."
      >
        <div className="mb-3">
          <Link className="btn btn-outline-secondary" href="/portal/admin/dashboard">
            Exit preview
          </Link>
        </div>
        <ParticipantProfile participant={participant} preview />
      </PortalShell>
    </div>
  );
};

export const getServerSideProps = async ({ params, req }) => {
  return buildAdminPreviewPageProps({ params, req });
};

AdminPreviewPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default AdminPreviewPage;
