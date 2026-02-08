import { useEffect, useState } from "react";
import Link from "next/link";
import RootLayout from "../../../../components/layout/layout";
import PortalShell from "../../../../components/Portal/PortalShell/PortalShell";
import PortalModal from "../../../../components/Portal/PortalModal/PortalModal";
import { requireSuperAdminSSR } from "../../../../utils/portal/ssr-helpers.js";
import AdminMenu from "../../../../components/Portal/AdminMenu/AdminMenu";
import { portalFetch } from "../../../../utils/portal/portal-fetch.js";
import {
  buildAdminPrefill,
  canRevokeAdmin,
  resolveAdminLookupStep,
} from "../../../../utils/portal/admins-client.js";

const AdminsPage = ({ adminRole, adminEmail }) => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState("lookup");
  const [lookupValue, setLookupValue] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [existingAdmin, setExistingAdmin] = useState(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "tournament-admin",
    initialPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState(null);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState("");

  const superAdminCount = admins.filter((a) => a.role === "super-admin").length;

  const loadAdmins = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await portalFetch("/api/portal/admins");
      if (!response.ok) {
        setError(`Unable to load admins (${response.status}).`);
        setAdmins([]);
        return;
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setAdmins(data);
      } else {
        setAdmins([]);
      }
    } catch (err) {
      setError("Unable to load admins.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const openModal = () => {
    setShowModal(true);
    setModalStep("lookup");
    setLookupValue("");
    setLookupError("");
    setExistingAdmin(null);
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      role: "tournament-admin",
      initialPassword: "",
    });
  };

  const handleLookup = async () => {
    if (!lookupValue.trim()) {
      setLookupError("Enter an email or phone number.");
      return;
    }
    setLookupError("");
    setExistingAdmin(null);
    setModalStep("lookup");
    try {
      const response = await portalFetch(
        `/api/portal/admins/lookup?q=${encodeURIComponent(lookupValue.trim())}`
      );
      const data = await response.json();
      const step = resolveAdminLookupStep({
        admin: data?.admin,
        participant: data?.participant,
      });
      if (step === "existing-admin") {
        setExistingAdmin(data.admin);
        return;
      }
      if (step === "participant") {
        window.location.href = `/portal/participant/${data.participant.pid}`;
        return;
      }
      const prefill = buildAdminPrefill(lookupValue);
      setForm((prev) => ({
        ...prev,
        email: prefill.email || prev.email,
        phone: prefill.phone || prev.phone,
      }));
      setModalStep("create");
    } catch (err) {
      setLookupError("Lookup failed. Please try again.");
    }
  };

  const handleFormChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setLookupError("");
    try {
      const response = await portalFetch("/api/portal/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setLookupError(data?.error || "Unable to create admin.");
        setIsSubmitting(false);
        return;
      }
      setShowModal(false);
      setModalStep("lookup");
      await loadAdmins();
    } catch (err) {
      setLookupError("Unable to create admin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRevokeModal = (admin) => {
    setRevokeTarget(admin);
    setRevokeError("");
    setShowRevokeModal(true);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    setRevokeError("");
    try {
      const response = await portalFetch(`/api/portal/admins/${revokeTarget.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        setRevokeError(data?.error || "Unable to revoke admin.");
        setIsRevoking(false);
        return;
      }
      setShowRevokeModal(false);
      setRevokeTarget(null);
      await loadAdmins();
    } catch (err) {
      setRevokeError("Unable to revoke admin.");
    } finally {
      setIsRevoking(false);
    }
  };

  const adminDisplayName = (admin) => {
    if (admin.first_name || admin.last_name) {
      return `${admin.first_name || ""} ${admin.last_name || ""}`.trim();
    }
    return admin.name || "";
  };

  return (
    <div>
      <PortalShell title="Admins" subtitle="Manage admin accounts and roles.">
        <div className="row g-3 mb-4 align-items-end">
          <div className="col-12 col-md-6">
            <p className="mb-0 text-muted">Total admins: {admins.length}</p>
          </div>
          <div className="col-12 col-md-6 text-md-end">
            <AdminMenu adminRole={adminRole} />
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {loading && <div className="text-muted">Loading admins...</div>}

        {admins.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm table-striped">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id}>
                    <td>
                      <Link href={`/portal/admin/admins/${admin.id}`}>
                        {admin.email || "\u2014"}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/portal/admin/admins/${admin.id}`}>
                        {adminDisplayName(admin) || "\u2014"}
                      </Link>
                    </td>
                    <td>{admin.phone || "\u2014"}</td>
                    <td>{admin.role}</td>
                    <td>{admin.created_at ? new Date(admin.created_at).toLocaleDateString() : "\u2014"}</td>
                    <td>
                      {canRevokeAdmin(admin, adminEmail, superAdminCount) && (
                        <button
                          className="btn btn-outline-danger btn-sm"
                          type="button"
                          onClick={() => openRevokeModal(admin)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3">
          <button className="btn btn-outline-primary btn-sm" type="button" onClick={openModal}>
            Create admin
          </button>
        </div>

        {showModal && (
          <PortalModal
            title="Create admin"
            onClose={() => { if (!isSubmitting) setShowModal(false); }}
            actions={
              <>
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                {modalStep === "create" && (
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleCreate}
                  >
                    {isSubmitting ? "Creating..." : "Create admin"}
                  </button>
                )}
              </>
            }
          >
            {modalStep === "lookup" && (
              <>
                {existingAdmin && (
                  <div className="alert alert-warning">
                    Admin already exists for this email/phone.
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label" htmlFor="admin-lookup">
                    Email or phone lookup
                  </label>
                  <div className="input-group">
                    <input
                      id="admin-lookup"
                      className="form-control"
                      type="text"
                      value={lookupValue}
                      onChange={(event) => setLookupValue(event.target.value)}
                      placeholder="admin@example.com or (555) 123-4567"
                    />
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={handleLookup}
                    >
                      Search
                    </button>
                  </div>
                </div>
                {lookupError && <div className="alert alert-danger mt-3">{lookupError}</div>}
              </>
            )}
            {modalStep === "create" && (
              <>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="first-name">
                      First name
                    </label>
                    <input
                      id="first-name"
                      className="form-control"
                      value={form.firstName}
                      onChange={handleFormChange("firstName")}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="last-name">
                      Last name
                    </label>
                    <input
                      id="last-name"
                      className="form-control"
                      value={form.lastName}
                      onChange={handleFormChange("lastName")}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="admin-email">
                      Email
                    </label>
                    <input
                      id="admin-email"
                      className="form-control"
                      value={form.email}
                      onChange={handleFormChange("email")}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="admin-phone">
                      Phone
                    </label>
                    <input
                      id="admin-phone"
                      className="form-control"
                      value={form.phone}
                      onChange={handleFormChange("phone")}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="admin-role">
                      Role
                    </label>
                    <select
                      id="admin-role"
                      className="form-select"
                      value={form.role}
                      onChange={handleFormChange("role")}
                    >
                      <option value="super-admin">Super admin</option>
                      <option value="tournament-admin">Tournament admin</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="initial-password">
                      Initial password
                    </label>
                    <input
                      id="initial-password"
                      className="form-control"
                      type="password"
                      value={form.initialPassword}
                      onChange={handleFormChange("initialPassword")}
                    />
                  </div>
                </div>
                {lookupError && <div className="alert alert-danger mt-3">{lookupError}</div>}
              </>
            )}
          </PortalModal>
        )}

        {showRevokeModal && revokeTarget && (
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
              <strong>{adminDisplayName(revokeTarget) || revokeTarget.email}</strong>
              {adminDisplayName(revokeTarget) ? ` (${revokeTarget.email})` : ""}?
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

export const getServerSideProps = async ({ req }) =>
  requireSuperAdminSSR(req, (payload) => ({ adminEmail: payload.email }));

AdminsPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default AdminsPage;
