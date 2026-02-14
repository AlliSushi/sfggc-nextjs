import { useEffect, useRef, useState } from "react";
import PortalModal from "../PortalModal/PortalModal";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";
import { IMPORT_MODES, MAX_CSV_SIZE_BYTES } from "../../../utils/portal/import-constants.js";

const LanesPreviewModal = ({ lanesPreview, onClose, onConfirm, isImporting, error }) => (
  <PortalModal
    title="Lane Import Preview"
    onClose={onClose}
    actions={
      <>
        <button className="btn btn-secondary" type="button" onClick={onClose} disabled={isImporting}>
          Cancel
        </button>
        <button className="btn btn-primary" type="button" onClick={onConfirm} disabled={isImporting}>
          {isImporting
            ? "Importing..."
            : lanesPreview.unmatched.length > 0
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
    {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
  </PortalModal>
);

const ImportLanesModal = ({ onClose, onComplete }) => {
  const fileInputRef = useRef(null);
  const csvTextRef = useRef("");
  const [status, setStatus] = useState("Select a lanes CSV file to preview.");
  const [error, setError] = useState("");
  const [lanesPreview, setLanesPreview] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    // Match previous behavior: opening lanes import immediately prompts for file.
    setTimeout(() => fileInputRef.current?.click(), 0);
  }, []);

  const resetFileInput = (event) => {
    if (event?.target) event.target.value = "";
  };

  const handleFileChange = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setError("");
    setStatus("Uploading...");

    if (selected.size > MAX_CSV_SIZE_BYTES) {
      setError("CSV file too large (max 2MB).");
      setStatus("");
      resetFileInput(event);
      return;
    }

    try {
      const csvText = await selected.text();
      const response = await portalFetch("/api/portal/admin/import-lanes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, mode: IMPORT_MODES.PREVIEW }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Preview failed.");
        setStatus("");
        resetFileInput(event);
        return;
      }

      csvTextRef.current = csvText;
      setLanesPreview({ matched: data.matched, unmatched: data.unmatched });
      setStatus("");
      resetFileInput(event);
    } catch {
      setError("Lane import preview failed. Please try again.");
      setStatus("");
      resetFileInput(event);
    }
  };

  const handleConfirm = async () => {
    if (!lanesPreview) return;

    setError("");
    setStatus("Importing lanes...");
    setIsImporting(true);

    try {
      const response = await portalFetch("/api/portal/admin/import-lanes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: csvTextRef.current, mode: IMPORT_MODES.IMPORT }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Import failed.");
        setStatus("");
        setIsImporting(false);
        return;
      }

      setStatus(
        `Lane import complete: ${data.summary.updated} updated, ${data.summary.skipped} skipped`
      );
      setIsImporting(false);
      if (onComplete) await onComplete();
    } catch {
      setError("Lane import failed. Please try again.");
      setStatus("");
      setIsImporting(false);
    }
  };

  if (lanesPreview) {
    return (
      <LanesPreviewModal
        lanesPreview={lanesPreview}
        onClose={onClose}
        onConfirm={handleConfirm}
        isImporting={isImporting}
        error={error}
      />
    );
  }

  return (
    <PortalModal
      title="Import Lanes"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose CSV
          </button>
        </>
      }
    >
      <input
        ref={fileInputRef}
        className="d-none"
        type="file"
        accept=".csv"
        onChange={handleFileChange}
      />
      {status && <div className="alert alert-info mb-0">{status}</div>}
      {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
    </PortalModal>
  );
};

export default ImportLanesModal;
