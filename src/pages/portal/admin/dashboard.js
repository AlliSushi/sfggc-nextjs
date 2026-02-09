import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import AdminMenu from "../../../components/Portal/AdminMenu/AdminMenu";
import { toTeamSlug } from "../../../utils/portal/slug.js";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";
import {
  COOKIE_ADMIN,
  parseCookies,
  verifyToken,
} from "../../../utils/portal/session.js";

const AdminDashboardPage = () => {
  const router = useRouter();
  const [participants, setParticipants] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [adminRole, setAdminRole] = useState("");

  const verifySession = useCallback(async () => {
    const response = await fetch("/api/portal/admin/session");
    if (!response.ok) {
      router.push("/portal/");
      return false;
    }
    const data = await response.json();
    setAdminRole(data?.admin?.role || "");
    setAuthChecked(true);
    return true;
  }, [router]);

  const loadParticipants = useCallback(
    async (searchValue) => {
      const ok = await verifySession();
      if (!ok) return;
      try {
        const response = await portalFetch(
          `/api/portal/participants?search=${encodeURIComponent(searchValue)}`
        );
        const data = await response.json();
        if (Array.isArray(data)) {
          setParticipants(
            data.map((row) => ({
              pid: row.pid,
              firstName: row.first_name,
              lastName: row.last_name,
              nickname: row.nickname,
              email: row.email,
              bookAverage: row.book_average,
              handicap: row.handicap,
              team: {
                name: row.team_name,
              },
            }))
          );
        }
      } catch (err) {
        setError("Unable to load participants from the database.");
      }
    },
    [verifySession]
  );

  useEffect(() => {
    loadParticipants(query);
  }, [loadParticipants, query]);

  const filtered = useMemo(() => {
    if (!query) {
      return participants;
    }
    const normalized = query.toLowerCase();
    return participants.filter((participant) => {
      const fullName = `${participant.firstName} ${participant.lastName}`.toLowerCase();
      return (
        participant.pid?.includes(normalized) ||
        participant.email?.toLowerCase().includes(normalized) ||
        fullName.includes(normalized)
      );
    });
  }, [participants, query]);

  return (
    <div>
      <PortalShell
        title="Admin dashboard"
        subtitle="Search participants and preview what they see."
      >
        <div className="row g-3 mb-4 align-items-end">
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="participant-search">
              Search participants
            </label>
            <input
              id="participant-search"
              className="form-control"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, PID, or email"
            />
          </div>
          <div className="col-12 col-md-6 text-md-end">
            <AdminMenu adminRole={adminRole} onImportComplete={() => loadParticipants(query)} />
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {!authChecked && <div className="text-muted">Checking session...</div>}
        {authChecked && (
          <div className="table-responsive">
          <table className="table table-striped align-middle">
            <thead>
              <tr>
                <th>PID</th>
                <th>Name</th>
                <th>Nickname</th>
                <th>Email</th>
                <th>Book Average</th>
                <th>Handicap</th>
                <th>Team</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((participant) => (
                <tr key={participant.pid}>
                  <td>{participant.pid}</td>
                  <td>
                    <Link href={`/portal/participant/${participant.pid}`}>
                      {participant.firstName} {participant.lastName}
                    </Link>
                  </td>
                  <td>{participant.nickname || "—"}</td>
                  <td>{participant.email || "—"}</td>
                  <td>{participant.bookAverage || "—"}</td>
                  <td>{participant.handicap ?? "—"}</td>
                  <td>
                    {participant.team?.name ? (
                      <Link
                        href={`/portal/team/${toTeamSlug(participant.team.name)}`}
                      >
                        {participant.team.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <Link
                      className="btn btn-sm btn-outline-secondary"
                      href={`/portal/admin/preview/${participant.pid}`}
                    >
                      View as participant
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted">
                    No participants match that search.
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

AdminDashboardPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export const getServerSideProps = async ({ req }) => {
  try {
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies[COOKIE_ADMIN];
    const payload = verifyToken(token);
    if (!payload) {
      return {
        redirect: {
          destination: "/portal/",
          permanent: false,
        },
      };
    }
  } catch (error) {
    return {
      redirect: {
        destination: "/portal/",
        permanent: false,
      },
    };
  }

  return { props: {} };
};

export default AdminDashboardPage;
