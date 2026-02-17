import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import ParticipantLookupForm from "../../../components/Portal/ParticipantLookupForm/ParticipantLookupForm";
import { getParticipantSession } from "../../../utils/portal/session.js";

const ParticipantLoginPage = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const expired = useMemo(() => router.query?.expired === "1", [router.query]);

  const handleSubmit = async (identifier) => {
    setIsSubmitting(true);
    setError("");
    setIsSubmitted(false);
    try {
      const response = await fetch("/api/portal/participant/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      if (!response.ok) {
        setError("Unable to send login link. Please try again.");
      } else {
        setIsSubmitted(true);
      }
    } catch (err) {
      setError("Unable to send login link. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PortalShell
        title="Participant access"
        subtitle="Enter your email address to receive a secure login link."
      >
        {expired && (
          <div className="alert alert-warning">
            Your login link has expired. Please request a new one.
          </div>
        )}
        {error && <div className="alert alert-danger">{error}</div>}
        {isSubmitted ? (
          <div className="alert alert-info mb-0">
            Please check your email and click on the login link.
          </div>
        ) : (
          <ParticipantLookupForm onSubmit={handleSubmit} disabled={isSubmitting} />
        )}
      </PortalShell>
    </div>
  );
};

export const getServerSideProps = async ({ req }) => {
  const session = getParticipantSession(req.headers.cookie || "");
  if (session?.pid) {
    return {
      redirect: {
        destination: `/portal/participant/${session.pid}`,
        permanent: false,
      },
    };
  }
  return { props: {} };
};

ParticipantLoginPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default ParticipantLoginPage;
