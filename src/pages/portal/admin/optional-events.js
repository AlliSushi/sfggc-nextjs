import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import AdminMenu from "../../../components/Portal/AdminMenu/AdminMenu";
import ImportOptionalEventsModal from "../../../components/Portal/ImportOptionalEventsModal/ImportOptionalEventsModal";
import useAdminSession from "../../../hooks/portal/useAdminSession.js";
import useVisibilityToggle from "../../../hooks/portal/useVisibilityToggle.js";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";
import { DIVISION_LABELS, DIVISION_ORDER } from "../../../utils/portal/division-constants.js";
import { formatScore } from "../../../utils/portal/display-constants.js";
import {
  createEmptyOptionalEventsStandings,
  hasAnyOptionalEvents,
} from "../../../utils/portal/optional-events.js";
import { getOptionalEventsVisibleToParticipants } from "../../../utils/portal/portal-settings-db.js";
import { requireSessionWithVisibilitySSR } from "../../../utils/portal/ssr-helpers.js";

const TOP_LIST_LIMIT = 6;
const TOP_DIVISION_LIMIT = 3;

const OptionalEventsPage = ({ initialParticipantsCanViewOptionalEvents = false }) => {
  const { isAdmin, adminRole } = useAdminSession();
  const [standings, setStandings] = useState(createEmptyOptionalEventsStandings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllBestOf3, setShowAllBestOf3] = useState(false);
  const [showAllHandicapped, setShowAllHandicapped] = useState(false);
  const [expandedDivisions, setExpandedDivisions] = useState({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const {
    value: participantsCanViewOptionalEvents,
    updateVisibility: updateOptionalEventsVisibility,
  } = useVisibilityToggle({
    initialValue: initialParticipantsCanViewOptionalEvents,
    endpoint: "/api/portal/admin/optional-events/visibility",
    valueKey: "participantsCanViewOptionalEvents",
    errorMessage: "Unable to update Optional Events visibility.",
  });

  const loadOptionalEvents = useCallback(() => {
    setLoading(true);
    setError("");
    return portalFetch("/api/portal/admin/optional-events")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load optional events.");
        }
        return data;
      })
      .then((data) => {
        const next = createEmptyOptionalEventsStandings();
        next.bestOf3Of9 = Array.isArray(data?.bestOf3Of9) ? data.bestOf3Of9 : [];
        next.allEventsHandicapped = Array.isArray(data?.allEventsHandicapped)
          ? data.allEventsHandicapped
          : [];
        for (const division of DIVISION_ORDER) {
          next.optionalScratch[division] = Array.isArray(data?.optionalScratch?.[division])
            ? data.optionalScratch[division]
            : [];
        }
        setStandings(next);
      })
      .catch(() => setError("Unable to load optional events."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadOptionalEvents();
  }, [loadOptionalEvents]);

  const bestOf3Rows = useMemo(
    () =>
      showAllBestOf3
        ? standings.bestOf3Of9
        : standings.bestOf3Of9.slice(0, TOP_LIST_LIMIT),
    [showAllBestOf3, standings.bestOf3Of9]
  );
  const handicappedRows = useMemo(
    () =>
      showAllHandicapped
        ? standings.allEventsHandicapped
        : standings.allEventsHandicapped.slice(0, TOP_LIST_LIMIT),
    [showAllHandicapped, standings.allEventsHandicapped]
  );
  const hasOptionalRows = hasAnyOptionalEvents(standings);

  const toggleDivision = (division) => {
    setExpandedDivisions((prev) => ({ ...prev, [division]: !prev[division] }));
  };

  return (
    <PortalShell
      title="Optional Events"
      subtitle="Standings for Best of 3 of 9, All Events Handicapped, and Optional Scratch."
    >
      {isAdmin && (
        <div className="d-flex justify-content-end mb-4 gap-2">
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => setShowImportModal(true)}
          >
            Import Optional Events
          </button>
          <button
            type="button"
            className={`btn ${participantsCanViewOptionalEvents ? "btn-success" : "btn-outline-secondary"}`}
            onClick={() =>
              updateOptionalEventsVisibility({
                enabled: !participantsCanViewOptionalEvents,
                canUpdate: isAdmin,
                onError: setError,
              })
            }
            aria-pressed={participantsCanViewOptionalEvents}
            aria-label="Participants can view Optional Events"
          >
            {participantsCanViewOptionalEvents ? "On" : "Off"}
          </button>
          <AdminMenu adminRole={adminRole} />
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}
      {importMessage && <div className="alert alert-success">{importMessage}</div>}
      {loading && <div className="text-muted">Loading optional events...</div>}

      {!loading && !hasOptionalRows && (
        <div className="alert alert-info">No optional-event standings are available yet.</div>
      )}

      {!loading && hasOptionalRows && (
        <>
          <section className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h3 className="h5 mb-0">Best of 3 of 9</h3>
              {standings.bestOf3Of9.length > TOP_LIST_LIMIT && (
                <button
                  className="btn btn-sm btn-outline-secondary"
                  type="button"
                  onClick={() => setShowAllBestOf3((v) => !v)}
                >
                  {showAllBestOf3 ? "Hide list" : "Show all"}
                </button>
              )}
            </div>
            <div className="table-responsive">
              <table className="table table-striped align-middle">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Bowler</th>
                    <th>Best 1</th>
                    <th>Best 2</th>
                    <th>Best 3</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bestOf3Rows.map((entry) => (
                    <tr key={entry.pid}>
                      <td>{entry.rank}</td>
                      <td>
                        <Link href={`/portal/participant/${entry.pid}`}>{entry.name}</Link>
                      </td>
                      <td>{formatScore(entry.bestGame1)}</td>
                      <td>{formatScore(entry.bestGame2)}</td>
                      <td>{formatScore(entry.bestGame3)}</td>
                      <td className="fw-semibold">{formatScore(entry.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h3 className="h5 mb-0">All Events Handicapped</h3>
              {standings.allEventsHandicapped.length > TOP_LIST_LIMIT && (
                <button
                  className="btn btn-sm btn-outline-secondary"
                  type="button"
                  onClick={() => setShowAllHandicapped((v) => !v)}
                >
                  {showAllHandicapped ? "Hide list" : "Show all"}
                </button>
              )}
            </div>
            <div className="table-responsive">
              <table className="table table-striped align-middle">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Bowler</th>
                    <th>Scratch Total</th>
                    <th>HDCP Total</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {handicappedRows.map((entry) => (
                    <tr key={entry.pid}>
                      <td>{entry.rank}</td>
                      <td>
                        <Link href={`/portal/participant/${entry.pid}`}>{entry.name}</Link>
                      </td>
                      <td>{formatScore(entry.totalScratch)}</td>
                      <td>{formatScore(entry.totalHdcp)}</td>
                      <td className="fw-semibold">{formatScore(entry.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="h5 mb-3">Optional Scratch</h3>
            {DIVISION_ORDER.map((division) => {
              const rows = standings.optionalScratch[division] || [];
              if (!rows.length) return null;
              const expanded = Boolean(expandedDivisions[division]);
              const visibleRows = expanded ? rows : rows.slice(0, TOP_DIVISION_LIMIT);
              return (
                <div key={division} className="mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h4 className="h6 mb-0">{DIVISION_LABELS[division]}</h4>
                    {rows.length > TOP_DIVISION_LIMIT && (
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        type="button"
                        onClick={() => toggleDivision(division)}
                      >
                        {expanded ? "Hide list" : "Show all"}
                      </button>
                    )}
                  </div>
                  <div className="table-responsive">
                    <table className="table table-striped align-middle">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Bowler</th>
                          <th>Scratch Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((entry) => (
                          <tr key={entry.pid}>
                            <td>{entry.rank}</td>
                            <td>
                              <Link href={`/portal/participant/${entry.pid}`}>{entry.name}</Link>
                            </td>
                            <td className="fw-semibold">{formatScore(entry.totalScratch)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
      {showImportModal && (
        <ImportOptionalEventsModal
          endpoint="/api/portal/admin/optional-events/import"
          onClose={() => setShowImportModal(false)}
          onComplete={async (summary) => {
            setShowImportModal(false);
            setImportMessage(
              `Optional Events import complete: ${summary?.updated ?? 0} updated, ${summary?.unchanged ?? 0} unchanged.`
            );
            await loadOptionalEvents();
          }}
        />
      )}
    </PortalShell>
  );
};

export const getServerSideProps = async ({ req }) => {
  return requireSessionWithVisibilitySSR({
    req,
    getParticipantVisibility: getOptionalEventsVisibleToParticipants,
    visibilityPropName: "initialParticipantsCanViewOptionalEvents",
  });
};

OptionalEventsPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default OptionalEventsPage;
