import { useRef, useState } from "react";
import PortalModal from "../PortalModal/PortalModal";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";
import { EVENT_LABELS } from "../../../utils/portal/event-constants.js";
import { IMPORT_MODES, MAX_CSV_SIZE_BYTES } from "../../../utils/portal/import-constants.js";
import styles from "./ImportScoresModal.module.scss";

const EVENT_OPTIONS = [
  { value: "team", label: EVENT_LABELS.team },
  { value: "doubles", label: EVENT_LABELS.doubles },
  { value: "singles", label: EVENT_LABELS.singles },
];
const WARNING_LABELS = {
  team_mismatch: "Team mismatch",
  lane_mismatch: "Lane mismatch",
  no_doubles_partner: "No doubles partner",
};
const WARNING_TABLE_SCROLL_STYLE = { maxHeight: "200px", overflowY: "auto" };
const UNMATCHED_TABLE_SCROLL_STYLE = { maxHeight: "200px", overflowY: "auto" };
const MATCHED_TABLE_SCROLL_STYLE = { maxHeight: "300px", overflowY: "auto" };

const ImportScoresModal = ({ onClose, onComplete }) => {
  const [step, setStep] = useState("select-event");
  const [eventType, setEventType] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const fileInputRef = useRef(null);
  const csvTextRef = useRef("");

  const handleSelectEventType = (type) => {
    setEventType(type);
    setError("");
    // Open file picker immediately after selecting event type
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handleFileChange = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_CSV_SIZE_BYTES) {
      setError("CSV file too large (max 2MB).");
      event.target.value = "";
      return;
    }

    setStatus("Uploading...");
    setError("");

    try {
      const csvText = await selected.text();
      csvTextRef.current = csvText;

      const response = await portalFetch("/api/portal/admin/import-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, mode: IMPORT_MODES.PREVIEW, eventType }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Preview failed.");
        setStatus("");
        event.target.value = "";
        return;
      }

      setPreview(data);
      setStep("preview");
      setStatus("");
    } catch {
      setError("Score import preview failed. Please try again.");
      setStatus("");
    }
    event.target.value = "";
  };

  const handleConfirm = async () => {
    setStep("importing");
    setStatus("Importing scores...");
    setError("");

    try {
      const response = await portalFetch("/api/portal/admin/import-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText: csvTextRef.current,
          mode: IMPORT_MODES.IMPORT,
          eventType,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Import failed.");
        setStep("preview");
        setStatus("");
        return;
      }

      setStatus(
        `Score import complete: ${data.summary.updated} updated, ${data.summary.skipped} unchanged`
      );
      csvTextRef.current = "";
      if (onComplete) await onComplete(eventType);
    } catch {
      setError("Score import failed. Please try again.");
      setStep("preview");
      setStatus("");
    }
  };

  const handleBack = () => {
    setStep("select-event");
    setPreview(null);
    setError("");
    setStatus("");
    csvTextRef.current = "";
  };

  // --- Select Event Type step ---
  if (step === "select-event") {
    return (
      <PortalModal
        title="Import Scores"
        onClose={onClose}
        actions={
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        }
      >
        <p>Select the event type for this score import:</p>
        <div className={styles.EventButtons}>
          {EVENT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className="btn btn-outline-primary btn-lg"
              type="button"
              onClick={() => handleSelectEventType(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          ref={fileInputRef}
          className="d-none"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
        />
        {status && <div className="alert alert-info mt-3 mb-0">{status}</div>}
        {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
      </PortalModal>
    );
  }

  // --- Preview step ---
  if (step === "preview" && preview) {
    const eventLabel = EVENT_LABELS[eventType] || eventType;
    const hasBlockingWarnings = preview.warnings?.some((w) => w.type === "no_doubles_partner");
    return (
      <PortalModal
        title={`Import ${eventLabel} Scores`}
        onClose={onClose}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={handleBack}>
              Back
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleConfirm}
              disabled={preview.matched.length === 0 || hasBlockingWarnings}
            >
              {preview.unmatched.length > 0
                ? `Skip Unmatched & Import ${preview.matched.length}`
                : `Import All ${preview.matched.length}`}
            </button>
          </>
        }
      >
        <p>
          <strong>{preview.matched.length}</strong> matched,{" "}
          <strong>{preview.unmatched.length}</strong> unmatched
        </p>

        {/* Warnings */}
        {preview.warnings?.length > 0 && (
          <>
            <p className="text-warning mb-2">
              <strong>{preview.warnings.length}</strong> cross-reference warning(s):
            </p>
            <div className="table-responsive" style={WARNING_TABLE_SCROLL_STYLE}>
              <table className="table table-sm table-striped mb-3">
                <thead>
                  <tr>
                    <th>Bowler</th>
                    <th>Warning</th>
                    <th>DB Value</th>
                    <th>CSV Value</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.warnings.map((w, i) => (
                    <tr key={i}>
                      <td>{w.name}</td>
                      <td>{WARNING_LABELS[w.type] || "Warning"}</td>
                      <td>{w.expected || "\u2014"}</td>
                      <td>{w.actual || "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Unmatched */}
        {preview.unmatched.length > 0 && (
          <>
            <p className="text-muted mb-2">Unmatched bowlers will be skipped:</p>
            <div className="table-responsive" style={UNMATCHED_TABLE_SCROLL_STYLE}>
              <table className="table table-sm table-striped mb-3">
                <thead>
                  <tr>
                    <th>Bowler Name</th>
                    <th>CSV Team</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.unmatched.map((row, i) => (
                    <tr key={i}>
                      <td>{row.name || "\u2014"}</td>
                      <td>{row.csvTeamName || "\u2014"}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Matched preview */}
        {preview.matched.length > 0 && (
          <>
            <p className="text-muted mb-2">Scores to import:</p>
            <div className="table-responsive" style={MATCHED_TABLE_SCROLL_STYLE}>
              <table className="table table-sm table-striped mb-0">
                <thead>
                  <tr>
                    <th>Bowler</th>
                    <th>Team</th>
                    <th>G1</th>
                    <th>G2</th>
                    <th>G3</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.matched.map((m) => (
                    <tr key={m.pid}>
                      <td>{`${m.firstName} ${m.lastName}`.trim()}</td>
                      <td>{m.csvTeamName || "\u2014"}</td>
                      <td>{m.game1 ?? "\u2014"}</td>
                      <td>{m.game2 ?? "\u2014"}</td>
                      <td>{m.game3 ?? "\u2014"}</td>
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

  // --- Importing step ---
  return (
    <PortalModal
      title="Import Scores"
      onClose={onClose}
      actions={
        <button className="btn btn-secondary" type="button" onClick={onClose} disabled>
          Please wait...
        </button>
      }
    >
      {status && <div className="alert alert-info mb-0">{status}</div>}
      {error && <div className="alert alert-danger mb-0">{error}</div>}
    </PortalModal>
  );
};

export default ImportScoresModal;
