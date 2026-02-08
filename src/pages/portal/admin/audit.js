import { useEffect, useMemo, useState } from "react";
import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import AdminMenu from "../../../components/Portal/AdminMenu/AdminMenu";
import PortalModal from "../../../components/Portal/PortalModal/PortalModal";
import { requireSuperAdminSSR } from "../../../utils/portal/ssr-helpers.js";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";

const AuditPage = ({ adminEmail, adminRole }) => {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("desc");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showClearModal, setShowClearModal] = useState(false);

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("sort", sort);
    return params.toString();
  }, [query, sort]);

  useEffect(() => {
    setLoading(true);
    setError("");
    portalFetch(`/api/portal/admin/audit?${searchParams}`)
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRows(data);
        } else {
          setRows([]);
        }
      })
      .catch(() => {
        setError("Unable to load audit log.");
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const clearLogs = async () => {
    setError("");
    try {
      const response = await portalFetch("/api/portal/admin/audit/clear", { method: "POST" });
      if (!response.ok) {
        setError("Unable to clear the audit log.");
        return;
      }
      setRows([]);
      setShowClearModal(false);
    } catch (err) {
      setError("Unable to clear the audit log.");
    }
  };

  return (
    <div>
      <PortalShell
        title="Audit log"
        subtitle={`Viewing changes recorded by admins${adminEmail ? ` · ${adminEmail}` : ""}`}
      >
        <div className="row g-3 mb-4 align-items-end">
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="audit-search">
              Search by participant, team, or admin
            </label>
            <input
              id="audit-search"
              className="form-control"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Participant, team, or admin email"
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label" htmlFor="audit-sort">
              Sort by date
            </label>
            <select
              id="audit-sort"
              className="form-select"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
          <div className="col-12 col-md-3 text-md-end">
            <AdminMenu adminRole={adminRole} />
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {loading && <div className="text-muted">Loading audit log...</div>}

        {!loading && rows.length === 0 && <div>No changes found.</div>}

        {rows.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm table-striped">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Admin</th>
                  <th>Participant</th>
                  <th>Team</th>
                  <th>Field</th>
                  <th>Old</th>
                  <th>New</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const formattedDate = row.changed_at
                    ? new Date(row.changed_at).toLocaleString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—";
                  return (
                  <tr key={row.id || `${row.pid}-${row.field}-${row.changed_at}`}>
                    <td>{formattedDate}</td>
                    <td>{row.admin_email || "—"}</td>
                    <td>
                      {row.first_name || row.last_name
                        ? `${row.first_name || ""} ${row.last_name || ""}`.trim()
                        : row.pid || "—"}
                    </td>
                    <td>{row.team_name || "—"}</td>
                    <td>{row.field}</td>
                    <td>{row.old_value || "—"}</td>
                    <td>{row.new_value || "—"}</td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3">
          <button
            className="btn btn-outline-danger btn-sm"
            type="button"
            onClick={() => setShowClearModal(true)}
          >
            Clear Log
          </button>
        </div>
        {showClearModal && (
          <PortalModal
            title="Clear audit log"
            onClose={() => setShowClearModal(false)}
            actions={
              <>
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => setShowClearModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-danger" type="button" onClick={clearLogs}>
                  Yes, clear logs
                </button>
              </>
            }
          >
            <p className="mb-0">
              Are you sure you want to clear the audit log? This will delete all entries.
            </p>
          </PortalModal>
        )}
      </PortalShell>
    </div>
  );
};

export const getServerSideProps = async ({ req }) =>
  requireSuperAdminSSR(req, (payload) => ({ adminEmail: payload.email || "" }));

AuditPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default AuditPage;
