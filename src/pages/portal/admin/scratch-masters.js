import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import PortalModal from "../../../components/Portal/PortalModal/PortalModal";
import AdminMenu from "../../../components/Portal/AdminMenu/AdminMenu";
import ImportScratchMastersModal from "../../../components/Portal/ImportScratchMastersModal/ImportScratchMastersModal";
import useAdminSession from "../../../hooks/portal/useAdminSession.js";
import useVisibilityToggle from "../../../hooks/portal/useVisibilityToggle.js";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";
import { DIVISION_LABELS, DIVISION_ORDER } from "../../../utils/portal/division-constants.js";
import {
  createEmptyScratchMasters,
  hasAnyScratchMasters,
} from "../../../utils/portal/scratch-masters.js";
import { formatScore } from "../../../utils/portal/display-constants.js";
import { getScratchMastersVisibleToParticipants } from "../../../utils/portal/portal-settings-db.js";
import { requireSessionWithVisibilitySSR } from "../../../utils/portal/ssr-helpers.js";

const SCRATCH_CUTOFF_BREAK_RANKS = [8, 9];
const SCRATCH_TABLE_HEADERS = [
  "#",
  "Bowler",
  "T1",
  "T2",
  "T3",
  "D1",
  "D2",
  "D3",
  "S1",
  "S2",
  "S3",
  "Scratch Total",
  "Total",
];
const SCRATCH_TABLE_COLUMN_COUNT = SCRATCH_TABLE_HEADERS.length;

const ScratchMastersPage = ({ initialParticipantsCanViewScratchMasters = false }) => {
  const { isAdmin, adminRole } = useAdminSession();
  const [standings, setStandings] = useState(createEmptyScratchMasters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const {
    value: participantsCanViewScratchMasters,
    updateVisibility: updateScratchMastersVisibility,
  } = useVisibilityToggle({
    initialValue: initialParticipantsCanViewScratchMasters,
    endpoint: "/api/portal/admin/scratch-masters/visibility",
    valueKey: "participantsCanViewScratchMasters",
    errorMessage: "Unable to update Scratch Masters visibility.",
  });

  const loadScratchMasters = useCallback(() => {
    setLoading(true);
    setError("");

    return portalFetch("/api/portal/admin/scratch-masters")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load scratch masters.");
        }
        return data;
      })
      .then((data) => {
        const nextStandings = createEmptyScratchMasters();
        for (const division of DIVISION_ORDER) {
          nextStandings[division] = Array.isArray(data?.[division]) ? data[division] : [];
        }
        setStandings(nextStandings);
      })
      .catch(() => {
        setError("Unable to load scratch masters.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadScratchMasters();
  }, [loadScratchMasters]);

  const visibleDivisions = useMemo(
    () => DIVISION_ORDER.filter((division) => (standings[division]?.length || 0) > 0),
    [standings]
  );
  const isSuperAdmin = adminRole === "super-admin";

  const clearScratchMasters = async () => {
    setError("");
    try {
      const response = await portalFetch("/api/portal/admin/scratch-masters/clear", {
        method: "POST",
      });
      if (!response.ok) {
        setError("Unable to clear scratch masters.");
        return;
      }
      setShowClearModal(false);
      await loadScratchMasters();
    } catch {
      setError("Unable to clear scratch masters.");
    }
  };

  return (
    <PortalShell
      title="Scratch Masters"
      subtitle="Cumulative division standings using all available team, doubles, and singles scores."
    >
      {isAdmin && (
        <div className="d-flex justify-content-end mb-4 gap-2">
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => setShowImportModal(true)}
          >
            Import Scratch Masters
          </button>
          <button
            type="button"
            className={`btn ${participantsCanViewScratchMasters ? "btn-success" : "btn-outline-secondary"}`}
            onClick={() =>
              updateScratchMastersVisibility({
                enabled: !participantsCanViewScratchMasters,
                canUpdate: isAdmin,
                onError: setError,
              })
            }
            aria-pressed={participantsCanViewScratchMasters}
            aria-label="Participants can view Scratch Masters"
          >
            {participantsCanViewScratchMasters ? "On" : "Off"}
          </button>
          {isSuperAdmin && (
            <button
              className="btn btn-outline-danger"
              type="button"
              onClick={() => setShowClearModal(true)}
            >
              Clear Scratch Masters
            </button>
          )}
          <AdminMenu adminRole={adminRole} />
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div className="text-muted">Loading scratch masters...</div>}

      {!loading && !hasAnyScratchMasters(standings) && (
        <div className="alert alert-info">
          No division standings are available yet.
        </div>
      )}

      {!loading &&
        visibleDivisions.map((division) => (
          <div key={division} className="mb-4">
            <h3 className="h5 mb-3">{DIVISION_LABELS[division]}</h3>
            <div className="table-responsive">
              <table className="table table-striped align-middle">
                <thead>
                  <tr>
                    {SCRATCH_TABLE_HEADERS.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings[division].map((entry) => (
                    <Fragment key={entry.pid}>
                      <tr>
                        <td>{entry.rank}</td>
                        <td>
                          <Link href={`/portal/participant/${entry.pid}`}>{entry.name}</Link>
                        </td>
                        <td>{formatScore(entry.t1)}</td>
                        <td>{formatScore(entry.t2)}</td>
                        <td>{formatScore(entry.t3)}</td>
                        <td>{formatScore(entry.d1)}</td>
                        <td>{formatScore(entry.d2)}</td>
                        <td>{formatScore(entry.d3)}</td>
                        <td>{formatScore(entry.s1)}</td>
                        <td>{formatScore(entry.s2)}</td>
                        <td>{formatScore(entry.s3)}</td>
                        <td className="fw-semibold">{formatScore(entry.totalScratch)}</td>
                        <td className="fw-semibold">{formatScore(entry.total)}</td>
                      </tr>
                      {SCRATCH_CUTOFF_BREAK_RANKS.includes(entry.rank) &&
                        standings[division].length > entry.rank && (
                        <tr className="scratch-cutoff-row">
                          <td
                            colSpan={SCRATCH_TABLE_COLUMN_COUNT}
                            className="bg-white p-0"
                            style={{ height: "6px", lineHeight: 0 }}
                          />
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      {showImportModal && (
        <ImportScratchMastersModal
          onClose={() => setShowImportModal(false)}
          onComplete={async () => {
            setShowImportModal(false);
            await loadScratchMasters();
          }}
        />
      )}
      {showClearModal && (
        <PortalModal
          title="Clear scratch masters"
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
              <button className="btn btn-danger" type="button" onClick={clearScratchMasters}>
                Yes, clear scratch masters
              </button>
            </>
          }
        >
          <p className="mb-0">
            Are you sure you want to clear scratch masters eligibility for all participants? This
            resets the list so you can import a new set.
          </p>
        </PortalModal>
      )}
    </PortalShell>
  );
};

export const getServerSideProps = async ({ req }) => {
  return requireSessionWithVisibilitySSR({
    req,
    getParticipantVisibility: getScratchMastersVisibleToParticipants,
    visibilityPropName: "initialParticipantsCanViewScratchMasters",
  });
};

ScratchMastersPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default ScratchMastersPage;
