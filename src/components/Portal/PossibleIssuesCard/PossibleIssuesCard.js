import Link from "next/link";

const PossibleIssuesCard = ({ possibleIssues }) => {
  if (!possibleIssues?.showSection || !Array.isArray(possibleIssues.issues) || possibleIssues.issues.length === 0) {
    return null;
  }

  return (
    <div className="card mb-4">
      <div className="card-body">
        <h5 className="card-title mb-2">Possible Issues</h5>
        <p className="text-muted mb-3">
          Lane coverage: {possibleIssues.coverage?.participantsWithLane ?? 0}/
          {possibleIssues.coverage?.totalParticipants ?? 0} (
          {possibleIssues.coverage?.laneCoveragePct ?? 0}%)
        </p>
        <ul className="mb-0">
          {possibleIssues.issues.map((issue) => (
            <li key={issue.key} className="mb-3">
              <strong>{issue.title}</strong> ({issue.count})
              {issue.details?.length > 0 && (
                <div className="table-responsive mt-2">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>PID</th>
                        <th>Participant</th>
                        <th>Issue detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issue.details.map((detail, index) => (
                        <tr key={`${issue.key}-${detail.pid || "missing"}-${index}`}>
                          <td>{detail.pid || "—"}</td>
                          <td>
                            {detail.pid ? (
                              <Link href={`/portal/participant/${detail.pid}`}>{detail.name}</Link>
                            ) : (
                              detail.name
                            )}
                          </td>
                          <td>
                            <div>{detail.detail || "—"}</div>
                            {Array.isArray(detail.relatedParticipants) &&
                              detail.relatedParticipants.length > 0 && (
                                <div className="small">
                                  Related:
                                  {" "}
                                  {detail.relatedParticipants.map((related, relIndex) => (
                                    <span key={`${detail.pid}-rel-${related.pid}-${relIndex}`}>
                                      {relIndex > 0 ? ", " : ""}
                                      <Link href={`/portal/participant/${related.pid}`}>
                                        {related.name}
                                      </Link>
                                      {" "}
                                      ({related.pid})
                                    </span>
                                  ))}
                                </div>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PossibleIssuesCard;
