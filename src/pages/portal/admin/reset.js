import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import AckMessage from "../../../components/Portal/AckMessage/AckMessage";

const AdminResetPage = () => {
  return (
    <div>
      <PortalShell title="Reset your password">
        <AckMessage
          title="Check your email"
          message="If the email you entered is registered, a reset link has been sent."
          note="We do not confirm whether an email exists for security reasons."
        />
      </PortalShell>
    </div>
  );
};

AdminResetPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default AdminResetPage;
