import Link from "next/link";

const TeamLinks = ({ teamSlug, teamName, tnmtId }) => {
  if (!teamSlug) {
    return null;
  }

  return (
    <div className="col-12">
      <div className="small text-muted">
        <Link href={`/portal/team/${teamSlug}`}>{teamName}</Link>
        {tnmtId ? (
          <>
            {" "}
            ·{" "}
            <Link href={`/portal/team/${teamSlug}`}>
              Team ID {tnmtId}
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default TeamLinks;
