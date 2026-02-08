import Link from "next/link";
import ScoreCard from "../ScoreCard/ScoreCard";
import styles from "./TeamProfile.module.scss";

const TEAM_SIZE = 4;

const TeamProfile = ({ team, roster = [], isAdmin = false }) => {
  if (!team) {
    return (
      <section className={`${styles.TeamProfile} card`}>
        <div className="card-body">
          <h2 className="h5">Team not found</h2>
          <p className="mb-0">Try another team name.</p>
        </div>
      </section>
    );
  }

  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => roster[i] || null);

  return (
    <section className={`${styles.TeamProfile} card`}>
      <div className="card-body">
        <div className="d-flex flex-column flex-md-row justify-content-between">
          <div>
            <h2 className="h4 mb-1">{team.name}</h2>
            {team.location ? (
              <p className="mb-1">
                {[team.location.city, team.location.region, team.location.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : null}
            {isAdmin && <p className="mb-0">Team ID {team.tnmtId || "—"}</p>}
          </div>
        </div>

        <div className="mt-3">
          <ScoreCard label="Team scores" scores={team.scores} />
        </div>

        <div className="mt-3">
          <table className={`table table-borderless ${styles.RosterTable}`}>
            <thead>
              <tr>
                <th scope="col" className={styles.RosterHeader}>
                  Roster
                </th>
                <th scope="col" className={styles.RosterHeader}>
                  Doubles Partner
                </th>
              </tr>
            </thead>
            <tbody>
              {[0, 2].map((startIndex) => (
                <tr key={startIndex}>
                  {[startIndex, startIndex + 1].map((index) => {
                    const member = slots[index];
                    return (
                      <td key={member?.pid || index} className={styles.RosterCell}>
                        {member ? (
                          <>
                            <p className={`${styles.MemberName} mb-1 fw-semibold`}>
                              <Link href={`/portal/participant/${member.pid}`}>
                                {member.name}
                              </Link>
                              {member.isCaptain && (
                                <span className={styles.CaptainLabel}>
                                  {" "}
                                  (Team Captain)
                                </span>
                              )}
                            </p>
                            {isAdmin && <p className="mb-0 text-muted">PID {member.pid}</p>}
                          </>
                        ) : (
                          <p className="mb-0 text-muted">Roster spot open</p>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {isAdmin && (
            <div className="mt-3">
              <Link className="btn btn-outline-secondary btn-sm" href="/portal/admin/dashboard">
                Back to dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default TeamProfile;
