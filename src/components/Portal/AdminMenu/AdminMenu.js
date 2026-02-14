import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import PortalModal from "../PortalModal/PortalModal";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";
import styles from "./AdminMenu.module.scss";

const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024;

/** Inline sub-component: renders the lanes preview/confirm modal with unmatched participant table. */
const LanesPreviewModal = ({ lanesPreview, onClose, onConfirm }) => (
  <PortalModal
    title="Lane Import Preview"
    onClose={onClose}
    actions={
      <>
        <button className="btn btn-secondary" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" type="button" onClick={onConfirm}>
          {lanesPreview.unmatched.length > 0
            ? `Skip Unmatched & Import ${lanesPreview.matched.length}`
            : `Import All ${lanesPreview.matched.length}`}
        </button>
      </>
    }
  >
    <p>
      <strong>{lanesPreview.matched.length}</strong> matched,{" "}
      <strong>{lanesPreview.unmatched.length}</strong> unmatched
    </p>
    {lanesPreview.unmatched.length > 0 && (
      <>
        <p className="text-muted mb-2">Unmatched participants will be skipped:</p>
        <div className="table-responsive" style={{ maxHeight: "300px", overflowY: "auto" }}>
          <table className="table table-sm table-striped mb-0">
            <thead>
              <tr>
                <th>PID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {lanesPreview.unmatched.map((row, index) => (
                <tr key={row.pid || index}>
                  <td>{row.pid || "\u2014"}</td>
                  <td>{`${row.firstName} ${row.lastName}`.trim() || "\u2014"}</td>
                  <td>{row.email || "\u2014"}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )}
  </PortalModal>
);

const AdminMenu = ({ adminRole, onImportComplete }) => {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);

  // Lanes import state
  const lanesFileInputRef = useRef(null);
  const lanesCsvTextRef = useRef("");
  const [lanesPreview, setLanesPreview] = useState(null);
  const [showLanesPreviewModal, setShowLanesPreviewModal] = useState(false);
  const [lanesImportStatus, setLanesImportStatus] = useState("");

  // Shared helpers to reduce duplication across XML and Lanes import handlers
  const showImportError = (message, setStatusFn) => {
    setErrorMessage(message);
    setShowErrorModal(true);
    setStatusFn("");
  };

  const resetFileInput = (event) => {
    if (event?.target) event.target.value = "";
  };

  const navigateToDashboard = async () => {
    if (onImportComplete) {
      await onImportComplete();
    }
    router.push("/portal/admin/dashboard");
  };

  const handleImportClick = () => {
    setErrorMessage("");
    setImportStatus("");
    fileInputRef.current?.click();
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/portal/admin/logout", { method: "POST" });
    } finally {
      router.push("/");
    }
  };

  const handleImportChange = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setErrorMessage("");
    setImportStatus("Uploading...");

    const formData = new FormData();
    formData.append("xml", selected);

    try {
      const response = await portalFetch("/api/portal/admin/import-xml", {
        method: "POST",
        body: formData,
      });
      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        data = null;
      }

      if (!response.ok) {
        showImportError(data?.error || "Import failed.", setImportStatus);
        resetFileInput(event);
        return;
      }

      setImportStatus(
        `Import complete: ${data.summary.people} people, ${data.summary.teams} teams`
      );
      resetFileInput(event);
      await navigateToDashboard();
    } catch (fetchError) {
      showImportError("Import failed. Please try again.", setImportStatus);
      resetFileInput(event);
    }
  };

  const handleImportLanesClick = () => {
    setErrorMessage("");
    setLanesImportStatus("");
    setLanesPreview(null);
    lanesCsvTextRef.current = "";
    lanesFileInputRef.current?.click();
  };

  const handleLanesFileChange = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setErrorMessage("");
    setLanesImportStatus("Uploading...");

    if (selected.size > MAX_CSV_SIZE_BYTES) {
      showImportError("CSV file too large (max 2MB).", setLanesImportStatus);
      resetFileInput(event);
      return;
    }

    try {
      const csvText = await selected.text();
      const response = await portalFetch("/api/portal/admin/import-lanes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, mode: "preview" }),
      });
      const data = await response.json();

      if (!response.ok) {
        showImportError(data?.error || "Preview failed.", setLanesImportStatus);
        resetFileInput(event);
        return;
      }

      lanesCsvTextRef.current = csvText;
      setLanesPreview({ matched: data.matched, unmatched: data.unmatched });
      setShowLanesPreviewModal(true);
      setLanesImportStatus("");
      resetFileInput(event);
    } catch (fetchError) {
      showImportError("Lane import preview failed. Please try again.", setLanesImportStatus);
      resetFileInput(event);
    }
  };

  const handleLanesConfirm = async () => {
    if (!lanesPreview) return;

    setLanesImportStatus("Importing lanes...");
    setShowLanesPreviewModal(false);

    try {
      const response = await portalFetch("/api/portal/admin/import-lanes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: lanesCsvTextRef.current, mode: "import" }),
      });
      const data = await response.json();

      if (!response.ok) {
        showImportError(data?.error || "Import failed.", setLanesImportStatus);
        return;
      }

      setLanesImportStatus(
        `Lane import complete: ${data.summary.updated} updated, ${data.summary.skipped} skipped`
      );
      setLanesPreview(null);
      lanesCsvTextRef.current = "";
      await navigateToDashboard();
    } catch (fetchError) {
      showImportError("Lane import failed. Please try again.", setLanesImportStatus);
    }
  };

  return (
    <div className={styles.AdminMenu}>
      {importStatus && <div className="alert alert-info">{importStatus}</div>}
      {lanesImportStatus && <div className="alert alert-info">{lanesImportStatus}</div>}
      <input
        ref={fileInputRef}
        className="d-none"
        type="file"
        accept=".xml"
        onChange={handleImportChange}
      />
      <input
        ref={lanesFileInputRef}
        className="d-none"
        type="file"
        accept=".csv"
        onChange={handleLanesFileChange}
      />
      <div className="dropdown">
        <button
          className="btn btn-outline-primary dropdown-toggle"
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          Admin
        </button>
        <ul className="dropdown-menu dropdown-menu-end">
          {adminRole === "super-admin" && (
            <>
              <li>
                <Link className="dropdown-item" href="/portal/admin/audit">
                  Audit Log
                </Link>
              </li>
              <li>
                <Link className="dropdown-item" href="/portal/admin/admins">
                  Create Admin
                </Link>
              </li>
              <li>
                <Link className="dropdown-item" href="/portal/admin/email-config">
                  Email Config
                </Link>
              </li>
              <li>
                <button className="dropdown-item" type="button" onClick={handleImportLanesClick}>
                  Import Lanes
                </button>
              </li>
              <li>
                <button className="dropdown-item" type="button" onClick={handleImportClick}>
                  Import XML
                </button>
              </li>
              <li>
                <Link className="dropdown-item" href="/portal/admin/lane-assignments">
                  Lane Assignments
                </Link>
              </li>
              <li>
                <Link className="dropdown-item" href="/portal/admin/dashboard">
                  Main Dashboard
                </Link>
              </li>
              <li>
                <hr className="dropdown-divider" />
              </li>
            </>
          )}
          <li>
            <button className="dropdown-item" type="button" onClick={handleLogout}>
              Logout
            </button>
          </li>
        </ul>
      </div>
      {showErrorModal && (
        <PortalModal
          title="Import failed"
          onClose={() => {
            setShowErrorModal(false);
            setErrorMessage("");
          }}
          actions={
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                setShowErrorModal(false);
                setErrorMessage("");
              }}
            >
              OK
            </button>
          }
        >
          <p className="mb-0">{errorMessage || "Import failed. Please try again."}</p>
        </PortalModal>
      )}
      {showLanesPreviewModal && lanesPreview && (
        <LanesPreviewModal
          lanesPreview={lanesPreview}
          onClose={() => {
            setShowLanesPreviewModal(false);
            setLanesPreview(null);
            lanesCsvTextRef.current = "";
          }}
          onConfirm={handleLanesConfirm}
        />
      )}
    </div>
  );
};

export default AdminMenu;
