import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import AdminLoginForm from "../../../components/Portal/AdminLoginForm/AdminLoginForm";

const AdminLoginPage = () => {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async ({ email, password }) => {
    setError("");
    setIsSubmitting(true);
    const response = await fetch("/api/portal/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data?.error || "Invalid credentials.");
      setIsSubmitting(false);
      return;
    }
    const data = await response.json();
    if (data?.needsReset) {
      await router.push("/portal/admin/reset-password");
      return;
    }
    await router.push("/portal/admin/dashboard");
  };

  return (
    <div>
      <PortalShell
        title="Admin login"
        subtitle="Sign in to manage registration, scores, and results."
      >
        {error && <div className="alert alert-danger">{error}</div>}
        <AdminLoginForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        <p className="mt-3">
          <Link href="/portal/admin/reset">Forgot your password?</Link>
        </p>
      </PortalShell>
    </div>
  );
};

AdminLoginPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default AdminLoginPage;
