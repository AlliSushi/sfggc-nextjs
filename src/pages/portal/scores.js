import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import RootLayout from "../../components/layout/layout";
import PortalShell from "../../components/Portal/PortalShell/PortalShell";
import AdminMenu from "../../components/Portal/AdminMenu/AdminMenu";
import PortalModal from "../../components/Portal/PortalModal/PortalModal";
import useAdminSession from "../../hooks/portal/useAdminSession.js";
import useVisibilityToggle from "../../hooks/portal/useVisibilityToggle.js";
import { portalFetch } from "../../utils/portal/portal-fetch.js";
import { EVENT_LABELS, EVENT_TYPE_LIST, EVENT_TYPES, resolveInitialEvent } from "../../utils/portal/event-constants.js";
import { appendFromParam, normalizeQueryValue, resolveBackHref } from "../../utils/portal/navigation.js";
import { hasAnyScores } from "../../utils/portal/score-standings.js";
import { formatScore } from "../../utils/portal/display-constants.js";
import { getScoresVisibleToParticipants } from "../../utils/portal/portal-settings-db.js";
import { requireSessionWithVisibilitySSR } from "../../utils/portal/ssr-helpers.js";
const EVENT_NAME_HEADERS = {
  [EVENT_TYPES.TEAM]: "Team",
  [EVENT_TYPES.DOUBLES]: "Pair",
  [EVENT_TYPES.SINGLES]: "Bowler",
};
const createEmptyStandings = () => ({
  [EVENT_TYPES.TEAM]: [],
  [EVENT_TYPES.DOUBLES]: [],
  [EVENT_TYPES.SINGLES]: [],
});

const renderScoreCells = (entry) => (
  <>
    <td>{formatScore(entry.game1)}</td>
    <td>{formatScore(entry.game2)}</td>
    <td>{formatScore(entry.game3)}</td>
    <td className="fw-semibold">{formatScore(entry.totalScratch)}</td>
    <td>{formatScore(entry.hdcp)}</td>
    <td className="fw-semibold">{formatScore(entry.total)}</td>
  </>
);

const ScoreStandingsPage = ({ initialParticipantsCanViewScores = false }) => {
  const router = useRouter();
  const { isAdmin, adminRole } = useAdminSession();
  const from = normalizeQueryValue(router.query.from);
  const backHref = resolveBackHref(from, "/portal/");
  const [selectedEvent, setSelectedEvent] = useState(
    resolveInitialEvent(router.query.event)
  );
  const [standings, setStandings] = useState(createEmptyStandings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showClearModal, setShowClearModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { value: participantsCanViewScores, updateVisibility: updateScoresVisibility } =
    useVisibilityToggle({
      initialValue: initialParticipantsCanViewScores,
      endpoint: "/api/portal/admin/scores/visibility",
      valueKey: "participantsCanViewScores",
      errorMessage: "Unable to update scores visibility.",
    });
  const isSuperAdmin = adminRole === "super-admin";

  useEffect(() => {
    if (router.query.event) {
      setSelectedEvent(resolveInitialEvent(router.query.event));
    }
  }, [router.query.event]);

  useEffect(() => {
    setLoading(true);
    setError("");

    portalFetch("/api/portal/scores")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load scores.");
        }
        return data;
      })
      .then((data) => {
        const nextStandings = createEmptyStandings();
        nextStandings[EVENT_TYPES.TEAM] = Array.isArray(data?.team) ? data.team : [];
        nextStandings[EVENT_TYPES.DOUBLES] = Array.isArray(data?.doubles) ? data.doubles : [];
        nextStandings[EVENT_TYPES.SINGLES] = Array.isArray(data?.singles) ? data.singles : [];
        setStandings(nextStandings);
      })
      .catch(() => {
        setError("Unable to load standings.");
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const clearScores = async () => {
    setError("");
    try {
      const response = await portalFetch("/api/portal/admin/scores/clear", { method: "POST" });
      if (!response.ok) {
        setError("Unable to clear scores.");
        return;
      }
      setShowClearModal(false);
      setRefreshKey((k) => k + 1);
    } catch {
      setError("Unable to clear scores.");
    }
  };

  const rows = useMemo(() => standings[selectedEvent] || [], [standings, selectedEvent]);
  const returnTo = "/portal/scores";

  const renderTeamRow = (entry) => (
    <tr key={entry.teamSlug}>
      <td>{entry.rank}</td>
      <td>
        <Link href={appendFromParam(`/portal/team/${entry.teamSlug}`, returnTo)}>
          {entry.teamName}
        </Link>
      </td>
      {renderScoreCells(entry)}
    </tr>
  );

  const renderDoublesRow = (entry, index) =>
    entry.members?.map((member, mi) => (
      <tr
        key={`d-${index}-${mi}`}
        className={mi === entry.members.length - 1 ? "border-bottom" : ""}
      >
        {mi === 0 && (
          <td rowSpan={entry.members.length}>{entry.rank}</td>
        )}
        <td>
          <Link href={appendFromParam(`/portal/participant/${member.pid}`, returnTo)}>
            {member.name}
          </Link>
        </td>
        {renderScoreCells(member)}
        {mi === 0 && (
          <>
            <td rowSpan={entry.members.length} className="fw-semibold">
              {formatScore(entry.doublesScratch)}
            </td>
            <td rowSpan={entry.members.length} className="fw-semibold">
              {formatScore(entry.doublesTotal)}
            </td>
          </>
        )}
      </tr>
    ));

  const renderSinglesRow = (entry) => (
    <tr key={entry.pid}>
      <td>{entry.rank}</td>
      <td>
        <Link href={appendFromParam(`/portal/participant/${entry.pid}`, returnTo)}>
          {entry.name}
        </Link>
      </td>
      {renderScoreCells(entry)}
    </tr>
  );

  const renderRow = (entry, index) => {
    if (selectedEvent === EVENT_TYPES.TEAM) return renderTeamRow(entry);
    if (selectedEvent === EVENT_TYPES.DOUBLES) return renderDoublesRow(entry, index);
    return renderSinglesRow(entry);
  };

  const nameHeader = EVENT_NAME_HEADERS[selectedEvent] || "Bowler";
  const isDoubles = selectedEvent === EVENT_TYPES.DOUBLES;

  return (
    <div>
      <PortalShell
        title="Standings"
        subtitle="View team, doubles, and singles standings ranked by total score."
      >
        {from && (
          <div className="mb-3">
            <Link className="btn btn-outline-secondary" href={backHref}>
              Back
            </Link>
          </div>
        )}

        <div className="row g-3 mb-4 align-items-end">
          <div className="col-12 col-md-8">
            <ul className="nav nav-tabs">
              {EVENT_TYPE_LIST.map((eventType) => (
                <li className="nav-item" key={eventType}>
                  <button
                    className={`nav-link${selectedEvent === eventType ? " active" : ""}`}
                    type="button"
                    onClick={() => setSelectedEvent(eventType)}
                  >
                    {EVENT_LABELS[eventType]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {isAdmin && (
            <div className="col-12 col-md-4 text-md-end d-flex justify-content-md-end gap-2">
              <button
                type="button"
                className={`btn ${participantsCanViewScores ? "btn-success" : "btn-outline-secondary"}`}
                onClick={() =>
                  updateScoresVisibility({
                    enabled: !participantsCanViewScores,
                    canUpdate: isAdmin,
                    onError: setError,
                  })
                }
                aria-pressed={participantsCanViewScores}
                aria-label="Participants can view standings"
              >
                {participantsCanViewScores ? "On" : "Off"}
              </button>
              {isSuperAdmin && (
                <button
                  className="btn btn-outline-danger"
                  type="button"
                  onClick={() => setShowClearModal(true)}
                >
                  Clear Scores
                </button>
              )}
              <AdminMenu
                adminRole={adminRole}
                onImportComplete={() => setRefreshKey((k) => k + 1)}
              />
            </div>
          )}
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {loading && <div className="text-muted">Loading standings...</div>}

        {!loading && !hasAnyScores(standings) && (
          <div className="alert alert-info">
            No scores have been imported yet.
          </div>
        )}

        {!loading && hasAnyScores(standings) && (
          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{nameHeader}</th>
                  <th>Game 1</th>
                  <th>Game 2</th>
                  <th>Game 3</th>
                  <th>Total Scratch</th>
                  <th>HDCP</th>
                  <th>Total</th>
                  {isDoubles && <th>Doubles Scratch</th>}
                  {isDoubles && <th>Doubles Total</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((entry, index) => renderRow(entry, index))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={isDoubles ? 10 : 8} className="text-center text-muted">
                      No {EVENT_LABELS[selectedEvent].toLowerCase()} scores found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {showClearModal && (
          <PortalModal
            title="Clear all scores"
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
                <button className="btn btn-danger" type="button" onClick={clearScores}>
                  Yes, clear all scores
                </button>
              </>
            }
          >
            <p className="mb-0">
              Are you sure you want to clear all scores? This will delete team, doubles, and singles
              scores for every participant. This action cannot be undone.
            </p>
          </PortalModal>
        )}
      </PortalShell>
    </div>
  );
};

export const getServerSideProps = async ({ req }) => {
  return requireSessionWithVisibilitySSR({
    req,
    getParticipantVisibility: getScoresVisibleToParticipants,
    visibilityPropName: "initialParticipantsCanViewScores",
    allowPublicWhenVisible: true,
  });
};

ScoreStandingsPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default ScoreStandingsPage;
