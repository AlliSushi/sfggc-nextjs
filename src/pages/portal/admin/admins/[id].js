import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import RootLayout from "../../../../components/layout/layout";
import PortalShell from "../../../../components/Portal/PortalShell/PortalShell";
import PortalModal from "../../../../components/Portal/PortalModal/PortalModal";
import { requireSuperAdminSSR, buildBaseUrl } from "../../../../utils/portal/ssr-helpers.js";
import AdminMenu from "../../../../components/Portal/AdminMenu/AdminMenu";
import { portalFetch } from "../../../../utils/portal/portal-fetch.js";
import { canRevokeAdmin } from "../../../../utils/portal/admins-client.js";

const buildFormState = (admin) => ({
  firstName: admin?.first_name || "",
  lastName: admin?.last_name || "",
  email: admin?.email || "",
  phone: admin?.phone || "",
  role: admin?.role || "tournament-admin",
});

const AdminDetailPage = ({ admin: initialAdmin, adminRole, adminEmail, superAdminCount }) => {
  const router = useRouter();
  const [admin, setAdmin] = useState(initialAdmin);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState(buildFormState(initialAdmin));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState("");

  const adminDisplayName = (a) => {
    if (a.first_name || a.last_name) {
      return `${a.first_name || ""} ${a.last_name || ""}`.trim();
    }
    return a.name || "";
  };

  const handleChange = (field) => (event) => {
    setFormState((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    try {
      const response = await portalFetch(`/api/portal/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data?.error || "Unable to save changes.");
        setIsSaving(false);
        return;
      }
      const refreshResponse = await portalFetch(`/api/portal/admins/${admin.id}`);
      const updated = await refreshResponse.json();
      setAdmin(updated);
      setFormState(buildFormState(updated));
      setIsEditing(false);
    } catch (err) {
      setError("Unable to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormState(buildFormState(admin));
    setError("");
  };

  const handleRevoke = async () => {
    setIsRevoking(true);
    setRevokeError("");
    try {
      const response = await portalFetch(`/api/portal/admins/${admin.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        setRevokeError(data?.error || "Unable to revoke admin.");
        setIsRevoking(false);
        return;
      }
      router.push("/portal/admin/admins");
    } catch (err) {
      setRevokeError("Unable to revoke admin.");
      setIsRevoking(false);
    }
  };

  if (!admin) {
    return (
      <div>
        <PortalShell title="Admin not found">
          <Link className="btn btn-outline-secondary" href="/portal/admin/admins">
            Back to admins
          </Link>
        </PortalShell>
      </div>
    );
  }

  return (
    <div>
      <PortalShell
        title="Admin details"
        subtitle={adminDisplayName(admin) || admin.email}
      >
        <div className="row g-3 mb-3 align-items-end">
          <div className="col-12 col-md-6 d-flex flex-wrap gap-2 portal-actions">
            <Link className="btn btn-outline-secondary" href="/portal/admin/admins">
              Back to admins
            </Link>
            {!isEditing && (
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                Modify
              </button>
            )}
            {isEditing && (
              <>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              </>
            )}
            {!isEditing && canRevokeAdmin(admin, adminEmail, superAdminCount) && (
              <button
                className="btn btn-outline-danger"
                type="button"
                onClick={() => setShowRevokeModal(true)}
              >
                Revoke
              </button>
            )}
          </div>
          <div className="col-12 col-md-6 text-md-end">
            <AdminMenu adminRole={adminRole} />
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {!isEditing && (
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <strong>First name</strong>
              <p>{admin.first_name || "\u2014"}</p>
            </div>
            <div className="col-12 col-md-6">
              <strong>Last name</strong>
              <p>{admin.last_name || "\u2014"}</p>
            </div>
            <div className="col-12 col-md-6">
              <strong>Email</strong>
              <p>{admin.email || "\u2014"}</p>
            </div>
            <div className="col-12 col-md-6">
              <strong>Phone</strong>
              <p>{admin.phone || "\u2014"}</p>
            </div>
            <div className="col-12 col-md-6">
              <strong>Role</strong>
              <p>
                <span className={`badge ${admin.role === "super-admin" ? "bg-danger" : "bg-primary"}`}>
                  {admin.role}
                </span>
              </p>
            </div>
            <div className="col-12 col-md-6">
              <strong>Participant</strong>
              <p>
                {admin.pid ? (
                  <Link href={`/portal/participant/${admin.pid}`}>{admin.pid}</Link>
                ) : (
                  "Not a participant"
                )}
              </p>
            </div>
            {admin.created_at && (
              <div className="col-12 col-md-6">
                <strong>Created</strong>
                <p>{new Date(admin.created_at).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        )}

        {isEditing && (
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="edit-first-name">
                First name
              </label>
              <input
                id="edit-first-name"
                className="form-control"
                value={formState.firstName}
                onChange={handleChange("firstName")}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="edit-last-name">
                Last name
              </label>
              <input
                id="edit-last-name"
                className="form-control"
                value={formState.lastName}
                onChange={handleChange("lastName")}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="edit-email">
                Email
              </label>
              <input
                id="edit-email"
                className="form-control"
                value={formState.email}
                onChange={handleChange("email")}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="edit-phone">
                Phone
              </label>
              <input
                id="edit-phone"
                className="form-control"
                value={formState.phone}
                onChange={handleChange("phone")}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="edit-role">
                Role
              </label>
              <select
                id="edit-role"
                className="form-select"
                value={formState.role}
                onChange={handleChange("role")}
              >
                <option value="super-admin">Super admin</option>
                <option value="tournament-admin">Tournament admin</option>
              </select>
            </div>
          </div>
        )}

        {showRevokeModal && (
          <PortalModal
            title="Revoke admin access"
            onClose={() => { if (!isRevoking) setShowRevokeModal(false); }}
            actions={
              <>
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  disabled={isRevoking}
                  onClick={() => setShowRevokeModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={isRevoking}
                  onClick={handleRevoke}
                >
                  {isRevoking ? "Revoking..." : "Revoke access"}
                </button>
              </>
            }
          >
            <p>
              Are you sure you want to revoke admin access for{" "}
              <strong>{adminDisplayName(admin) || admin.email}</strong>
              {adminDisplayName(admin) ? ` (${admin.email})` : ""}?
            </p>
            <p className="text-muted mb-0">
              This action will be recorded in the audit log.
            </p>
            {revokeError && <div className="alert alert-danger mt-3">{revokeError}</div>}
          </PortalModal>
        )}
      </PortalShell>
    </div>
  );
};

export const getServerSideProps = async ({ params, req }) => {
  const ssrResult = requireSuperAdminSSR(req, (payload) => ({
    adminEmail: payload.email,
  }));
  if (ssrResult.redirect) return ssrResult;

  const baseUrl = buildBaseUrl(req);
  try {
    const response = await fetch(
      `${baseUrl}/api/portal/admins/${encodeURIComponent(params.id)}`,
      { headers: { cookie: req.headers.cookie || "" } }
    );
    if (!response.ok) {
      return { notFound: true };
    }
    const admin = await response.json();

    const listResponse = await fetch(`${baseUrl}/api/portal/admins`, {
      headers: { cookie: req.headers.cookie || "" },
    });
    const admins = listResponse.ok ? await listResponse.json() : [];
    const superAdminCount = Array.isArray(admins)
      ? admins.filter((a) => a.role === "super-admin").length
      : 0;

    return {
      props: {
        ...ssrResult.props,
        admin,
        superAdminCount,
      },
    };
  } catch (error) {
    return { notFound: true };
  }
};

AdminDetailPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default AdminDetailPage;
