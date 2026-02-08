import { useRouter } from "next/router";
import { useState } from "react";
import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";

const AdminResetPasswordPage = () => {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const response = await portalFetch("/api/portal/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, confirmPassword }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data?.error || "Unable to reset password.");
      setIsSubmitting(false);
      return;
    }
    await router.push("/portal/admin/dashboard");
  };

  return (
    <div>
      <PortalShell title="Set your new password">
        {error && <div className="alert alert-danger">{error}</div>}
        <form className="row g-3" onSubmit={handleSubmit}>
          <div className="col-12">
            <label className="form-label" htmlFor="new-password">
              New password
            </label>
            <input
              className="form-control"
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 12 characters"
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              className="form-control"
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter new password"
            />
          </div>
          <div className="col-12">
            <button className="btn btn-primary w-100" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save password"}
            </button>
          </div>
        </form>
        <p className="mt-3 text-muted">
          Password must be at least 12 characters and include upper, lower, and a number.
        </p>
      </PortalShell>
    </div>
  );
};

AdminResetPasswordPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default AdminResetPasswordPage;
