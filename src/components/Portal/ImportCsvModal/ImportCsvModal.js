import { useEffect, useRef, useState } from "react";
import PortalModal from "../PortalModal/PortalModal";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";
import { IMPORT_MODES, MAX_CSV_SIZE_BYTES } from "../../../utils/portal/import-constants.js";

const TABLE_SCROLL_STYLE = { maxHeight: "260px", overflowY: "auto" };
const UNAUTHORIZED_IMPORT_ERROR =
  "Your admin session is not authorized for import. Please sign in again.";

const ImportCsvModal = ({
  title,
  endpoint,
  initialStatus,
  importingStatus,
  previewFailedMessage,
  importFailedMessage,
  buildCompleteStatus,
  warningMessage,
  requireMatchesForImport = false,
  noMatchesMessage = "",
  unmatchedNameLabel = "Bowler Name",
  onClose,
  onComplete,
}) => {
  const fileInputRef = useRef(null);
  const csvTextRef = useRef("");
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    setTimeout(() => fileInputRef.current?.click(), 0);
  }, []);

  const resetInput = (event) => {
    if (event?.target) event.target.value = "";
  };

  const postImportRequest = async (mode, csvText) => {
    const response = await portalFetch(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, mode }),
      },
      { allowAuthErrorResponses: true }
    );

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: UNAUTHORIZED_IMPORT_ERROR };
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: payload?.error || "Request failed." };
    }
    return { ok: true, payload };
  };

  const handleFileChange = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setError("");
    setStatus("Uploading...");

    if (selected.size > MAX_CSV_SIZE_BYTES) {
      setError("CSV file too large (max 2MB).");
      setStatus("");
      resetInput(event);
      return;
    }

    try {
      const csvText = await selected.text();
      const result = await postImportRequest(IMPORT_MODES.PREVIEW, csvText);
      if (!result.ok) {
        setError(result.error || "Preview failed.");
        setStatus("");
        resetInput(event);
        return;
      }

      csvTextRef.current = csvText;
      setPreview(result.payload);
      setStatus("");
      resetInput(event);
    } catch {
      setError(previewFailedMessage);
      setStatus("");
      resetInput(event);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setIsImporting(true);
    setError("");
    setStatus(importingStatus);

    try {
      const result = await postImportRequest(IMPORT_MODES.IMPORT, csvTextRef.current);
      if (!result.ok) {
        setError(result.error || "Import failed.");
        setStatus("");
        setIsImporting(false);
        return;
      }

      const summary = result.payload?.summary || {};
      setStatus(buildCompleteStatus(summary));
      setIsImporting(false);
      if (onComplete) {
        await onComplete(summary);
      }
    } catch {
      setError(importFailedMessage);
      setStatus("");
      setIsImporting(false);
    }
  };

  if (preview) {
    const hasMatches = (preview.matched?.length || 0) > 0;
    const applyDisabled = isImporting || (requireMatchesForImport && !hasMatches);

    return (
      <PortalModal
        title={title}
        onClose={onClose}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={onClose} disabled={isImporting}>
              Cancel
            </button>
            <button className="btn btn-primary" type="button" onClick={handleConfirm} disabled={applyDisabled}>
              {isImporting ? "Importing..." : "Apply Import"}
            </button>
          </>
        }
      >
        <p>
          <strong>{preview.matched?.length || 0}</strong> matched,{" "}
          <strong>{preview.unmatched?.length || 0}</strong> unmatched
        </p>

        {!!preview.warnings?.length && (
          <div className="alert alert-warning">{warningMessage(preview.warnings.length)}</div>
        )}

        {requireMatchesForImport && !hasMatches && !!noMatchesMessage && (
          <div className="alert alert-danger">{noMatchesMessage}</div>
        )}

        {!!preview.unmatched?.length && (
          <>
            <p className="text-muted mb-2">Unmatched rows:</p>
            <div className="table-responsive" style={TABLE_SCROLL_STYLE}>
              <table className="table table-sm table-striped mb-0">
                <thead>
                  <tr>
                    <th>{unmatchedNameLabel}</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.unmatched.map((row, index) => (
                    <tr key={`${row.name}-${index}`}>
                      <td>{row.name || "\u2014"}</td>
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
  }

  return (
    <PortalModal
      title={title}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="button" onClick={() => fileInputRef.current?.click()}>
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

export default ImportCsvModal;
