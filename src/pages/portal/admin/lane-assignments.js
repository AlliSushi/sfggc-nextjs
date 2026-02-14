import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import AdminMenu from "../../../components/Portal/AdminMenu/AdminMenu";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";
import { EVENT_LABELS, EVENT_TYPE_LIST, EVENT_TYPES } from "../../../utils/portal/event-constants.js";
import { EM_DASH } from "../../../utils/portal/lane-assignments.js";
import { requireAdminSSR } from "../../../utils/portal/ssr-helpers.js";
import { resolveLaneEntryHref } from "../../../utils/portal/navigation.js";

const toEntries = (row, side) => {
  const values = row?.[`${side}Entries`];
  if (Array.isArray(values) && values.length > 0) {
    return values;
  }
  return [{ label: row?.[side] || EM_DASH }];
};

const renderEntry = (entry, href) => {
  if (!entry) return EM_DASH;
  return href ? <Link href={href}>{entry.label}</Link> : entry.label;
};

const formatLanePairLabel = (lane) => `Lanes ${lane} & ${lane + 1}`;

const LaneAssignmentsPage = ({ adminRole }) => {
  const router = useRouter();
  const [selectedEvent, setSelectedEvent] = useState(EVENT_TYPES.TEAM);
  const [assignments, setAssignments] = useState({
    [EVENT_TYPES.TEAM]: [],
    [EVENT_TYPES.DOUBLES]: [],
    [EVENT_TYPES.SINGLES]: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    portalFetch("/api/portal/admin/lane-assignments")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load lane assignments.");
        }
        return data;
      })
      .then((data) => {
        setAssignments({
          [EVENT_TYPES.TEAM]: Array.isArray(data?.team) ? data.team : [],
          [EVENT_TYPES.DOUBLES]: Array.isArray(data?.doubles) ? data.doubles : [],
          [EVENT_TYPES.SINGLES]: Array.isArray(data?.singles) ? data.singles : [],
        });
      })
      .catch(() => {
        setError("Unable to load lane assignments.");
      })
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => assignments[selectedEvent] || [], [assignments, selectedEvent]);
  const entryHref = (entry) => {
    const currentPath = router.asPath || "/portal/admin/lane-assignments";
    return resolveLaneEntryHref(entry, currentPath);
  };

  return (
    <div>
      <PortalShell
        title="Lane assignments"
        subtitle="View lane-pair matchups for team, doubles, and singles events."
      >
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
          <div className="col-12 col-md-4 text-md-end">
            <AdminMenu adminRole={adminRole} />
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {loading && <div className="text-muted">Loading lane assignments...</div>}

        {!loading && (
          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>Lanes</th>
                  <th>Lane N</th>
                  <th>Lane N+1</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const leftEntries = toEntries(row, "left");
                  const rightEntries = toEntries(row, "right");
                  const lineCount = Math.max(leftEntries.length, rightEntries.length, 1);

                  return Array.from({ length: lineCount }, (_, index) => {
                    const leftEntry = leftEntries[index];
                    const rightEntry = rightEntries[index];
                    const leftHref = leftEntry ? entryHref(leftEntry) : "";
                    const rightHref = rightEntry ? entryHref(rightEntry) : "";

                    return (
                      <tr key={`${row.lane}-${index}`}>
                        {index === 0 && (
                          <td rowSpan={lineCount} className="align-top fw-semibold">
                            {formatLanePairLabel(row.lane)}
                          </td>
                        )}
                        <td>
                          {renderEntry(leftEntry, leftHref)}
                        </td>
                        <td>
                          {renderEntry(rightEntry, rightHref)}
                        </td>
                      </tr>
                    );
                  });
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted">
                      No {EVENT_LABELS[selectedEvent].toLowerCase()} lane assignments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </PortalShell>
    </div>
  );
};

export const getServerSideProps = async ({ req }) => requireAdminSSR(req);

LaneAssignmentsPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default LaneAssignmentsPage;
