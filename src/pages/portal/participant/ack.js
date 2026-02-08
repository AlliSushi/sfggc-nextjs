import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import AckMessage from "../../../components/Portal/AckMessage/AckMessage";

const ParticipantAckPage = () => {
  return (
    <div>
      <PortalShell title="Check your inbox">
        <AckMessage
          title="Login link sent"
          message="If the email address you entered is registered, a login link has been sent."
          note="This message is always shown to protect participant privacy."
        />
      </PortalShell>
    </div>
  );
};

ParticipantAckPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default ParticipantAckPage;
