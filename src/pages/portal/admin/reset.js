import { useState } from "react";
import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import AckMessage from "../../../components/Portal/AckMessage/AckMessage";
import { query } from "../../../utils/portal/db.js";
import { ensureAdminResetTables } from "../../../utils/portal/admins-server.js";
import {
  COOKIE_ADMIN_RESET,
  buildCookieString,
} from "../../../utils/portal/session.js";

const AdminResetPage = ({ tokenError }) => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/portal/admin/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // Ignore network errors — still show confirmation
    }
    setLoading(false);
    setSubmitted(true);
  };

  if (tokenError) {
    return (
      <div>
        <PortalShell title="Reset your password">
          <AckMessage
            title="Invalid or expired link"
            message="This password reset link is invalid or has expired."
            note="Please request a new reset link from the login page."
          />
          <div className="text-center mt-3">
            <a href="/portal/admin/" className="btn btn-outline-primary">
              Back to login
            </a>
          </div>
        </PortalShell>
      </div>
    );
  }

  if (submitted) {
    return (
      <div>
        <PortalShell title="Reset your password">
          <AckMessage
            title="Check your email"
            message="If the email you entered is registered, a reset link has been sent."
            note="We do not confirm whether an email exists for security reasons."
          />
          <div className="text-center mt-3">
            <a href="/portal/admin/" className="btn btn-outline-primary">
              Back to login
            </a>
          </div>
        </PortalShell>
      </div>
    );
  }

  return (
    <div>
      <PortalShell title="Reset your password" subtitle="Enter your admin email to receive a reset link.">
        <form onSubmit={handleSubmit} className="mx-auto" style={{ maxWidth: 400 }}>
          <div className="mb-3">
            <label className="form-label" htmlFor="reset-email">
              Admin email
            </label>
            <input
              id="reset-email"
              type="email"
              className="form-control"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
          <div className="text-center mt-3">
            <a href="/portal/admin/">Back to login</a>
          </div>
        </form>
      </PortalShell>
    </div>
  );
};

export const getServerSideProps = async ({ query: queryParams, res }) => {
  const token = queryParams?.token;

  if (!token) {
    return { props: {} };
  }

  try {
    await ensureAdminResetTables();

    const { rows } = await query(
      `select id, admin_id, expires_at, used_at
       from admin_password_resets
       where token = ?
       limit 1`,
      [token]
    );

    const reset = rows[0];
    if (!reset || reset.used_at || new Date(reset.expires_at) < new Date()) {
      return { props: { tokenError: true } };
    }

    const cookieString = buildCookieString(COOKIE_ADMIN_RESET, token, 3600);
    res.setHeader("Set-Cookie", cookieString);

    return {
      redirect: {
        destination: "/portal/admin/reset-password",
        permanent: false,
      },
    };
  } catch (error) {
    console.error("[reset] Token verification error:", error.message);
    return { props: { tokenError: true } };
  }
};

AdminResetPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default AdminResetPage;
