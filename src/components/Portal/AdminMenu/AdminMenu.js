import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import PortalModal from "../PortalModal/PortalModal";
import ImportLanesModal from "../ImportLanesModal/ImportLanesModal";
import ImportScoresModal from "../ImportScoresModal/ImportScoresModal";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";
import styles from "./AdminMenu.module.scss";

const AdminMenu = ({ adminRole, onImportComplete }) => {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showLanesModal, setShowLanesModal] = useState(false);

  // Scores import state
  const [showScoresModal, setShowScoresModal] = useState(false);

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
                <button className="dropdown-item" type="button" onClick={() => setShowLanesModal(true)}>
                  Import Lanes
                </button>
              </li>
              <li>
                <button className="dropdown-item" type="button" onClick={() => setShowScoresModal(true)}>
                  Import Scores
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
                <Link className="dropdown-item" href="/portal/scores">
                  Score Standings
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
      {showLanesModal && (
        <ImportLanesModal
          onClose={() => setShowLanesModal(false)}
          onComplete={async () => {
            setShowLanesModal(false);
            await navigateToDashboard();
          }}
        />
      )}
      {showScoresModal && (
        <ImportScoresModal
          onClose={() => setShowScoresModal(false)}
          onComplete={async (eventType) => {
            setShowScoresModal(false);
            if (onImportComplete) await onImportComplete();
            router.push(`/portal/scores?event=${eventType}`);
          }}
        />
      )}
    </div>
  );
};

export default AdminMenu;
