import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import PortalModal from "../PortalModal/PortalModal";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";
import styles from "./AdminMenu.module.scss";

const AdminMenu = ({ adminRole, onImportComplete }) => {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState("");
  const [importError, setImportError] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);

  const handleImportClick = () => {
    setImportError("");
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

    setImportError("");
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
        setImportError(data?.error || "Import failed.");
        setShowErrorModal(true);
        setImportStatus("");
        event.target.value = "";
        return;
      }

      setImportStatus(
        `Import complete: ${data.summary.people} people, ${data.summary.teams} teams`
      );
      event.target.value = "";
      if (onImportComplete) {
        await onImportComplete();
      }
      router.push("/portal/admin/dashboard");
    } catch (fetchError) {
      setImportError("Import failed. Please try again.");
      setShowErrorModal(true);
      setImportStatus("");
      event.target.value = "";
    }
  };

  return (
    <div className={styles.AdminMenu}>
      {importStatus && <div className="alert alert-info">{importStatus}</div>}
      <input
        ref={fileInputRef}
        className="d-none"
        type="file"
        accept=".xml"
        onChange={handleImportChange}
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
                <button className="dropdown-item" type="button" onClick={handleImportClick}>
                  Import XML
                </button>
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
          onClose={() => setShowErrorModal(false)}
          actions={
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setShowErrorModal(false)}
            >
              OK
            </button>
          }
        >
          <p className="mb-0">{importError || "Import failed. Please try again."}</p>
        </PortalModal>
      )}
    </div>
  );
};

export default AdminMenu;
