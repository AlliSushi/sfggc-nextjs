import Link from "next/link";
import ScoreCard from "../ScoreCard/ScoreCard";
import styles from "./ParticipantProfile.module.scss";
import { toTeamSlug } from "../../../utils/portal/slug.js";

const ParticipantProfile = ({
  participant,
  preview = false,
  isAdmin = false,
  partnerLinkBase = null,
}) => {
  const showAdminDetails = isAdmin || preview;
  const teamName = participant?.team?.name || "";
  const teamSlug = teamName ? toTeamSlug(teamName) : "";

  if (!participant) {
    return (
      <section className={`${styles.ParticipantProfile} card`}>
        <div className="card-body">
          <h2 className="h5">Participant not found</h2>
          <p className="mb-0">Try another participant ID.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.ParticipantProfile} card`}>
      <div className="card-body">
        {preview && (
          <div className={`${styles.PreviewBanner} alert alert-warning`}>
            Preview mode — you are viewing this as admin.
          </div>
        )}
        <div className="d-flex flex-column flex-md-row justify-content-between">
          <div>
            <h2 className="h4 mb-1">
              {participant.nickname || participant.firstName} {participant.lastName}
            </h2>
            {showAdminDetails && <p className="mb-2">PID {participant.pid}</p>}
          </div>
          {preview && (
            <div className="align-self-md-start">
              <span className="badge text-bg-secondary">Admin preview</span>
            </div>
          )}
        </div>

        <div className="row g-4 mt-2">
          <div className="col-12 col-md-6">
            <h3 className="h6">Contact</h3>
            <p className="mb-1">{participant.email || "Email not provided"}</p>
            <p className="mb-0">{participant.phone || "Phone not provided"}</p>
          </div>
          <div className="col-12 col-md-6">
            <h3 className="h6">Team</h3>
            <p className="mb-1">
              {teamName ? (
                teamSlug ? (
                  <Link href={`/portal/team/${teamSlug}`}>{teamName}</Link>
                ) : (
                  teamName
                )
              ) : (
                "TBD"
              )}
            </p>
            {showAdminDetails && (
              <p className="mb-0">
                Team ID{" "}
                {participant.team?.tnmtId ? (
                  teamSlug ? (
                    <Link href={`/portal/team/${teamSlug}`}>{participant.team.tnmtId}</Link>
                  ) : (
                    participant.team.tnmtId
                  )
                ) : (
                  "—"
                )}
              </p>
            )}
          </div>
        </div>

        <div className="row g-4 mt-2">
          <div className="col-12 col-md-4">
            <h3 className="h6">Lanes</h3>
            <p className="mb-1">Team: {participant.lanes?.team || "—"}</p>
            <p className="mb-1">Doubles: {participant.lanes?.doubles || "—"}</p>
            <p className="mb-0">Singles: {participant.lanes?.singles || "—"}</p>
          </div>
          <div className="col-12 col-md-4">
            <h3 className="h6">Doubles partner</h3>
            <p className="mb-1">
              {participant.doubles?.partnerPid ? (
                <Link
                  href={`${
                    partnerLinkBase ||
                    (preview ? "/portal/admin/preview" : "/portal/participant")
                  }/${participant.doubles.partnerPid}`}
                >
                  {participant.doubles?.partnerName || participant.doubles.partnerPid}
                </Link>
              ) : (
                participant.doubles?.partnerName || "Partner not assigned"
              )}
            </p>
            {showAdminDetails && (
              <p className="mb-0">
                Partner PID{" "}
                {participant.doubles?.partnerPid ? (
                  <Link
                    href={`${
                      partnerLinkBase ||
                      (preview ? "/portal/admin/preview" : "/portal/participant")
                    }/${participant.doubles.partnerPid}`}
                  >
                    {participant.doubles.partnerPid}
                  </Link>
                ) : (
                  "—"
                )}
              </p>
            )}
          </div>
          <div className="col-12 col-md-4">
            <h3 className="h6">Averages</h3>
            <p className="mb-1">
              Book Average: {participant.bookAverage ?? "—"}
            </p>
            <p className="mb-0">
              Handicap: {participant.averages?.handicap ?? "—"}
            </p>
          </div>
        </div>

        <div className="row g-4 mt-2">
          <div className="col-12">
            <ScoreCard label="Team scores" scores={participant.scores?.team} />
          </div>
          <div className="col-12">
            <ScoreCard label="Doubles scores" scores={participant.scores?.doubles} />
          </div>
          <div className="col-12">
            <ScoreCard label="Singles scores" scores={participant.scores?.singles} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ParticipantProfile;
