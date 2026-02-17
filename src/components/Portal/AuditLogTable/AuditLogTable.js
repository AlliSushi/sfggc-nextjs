const AuditLogTable = ({ auditLogs }) => (
  <div className="mt-4">
    <h2 className="h5">Change log</h2>
    {auditLogs.length === 0 && (
      <p className="text-muted">No changes recorded yet.</p>
    )}
    {auditLogs.length > 0 && (
      <div className="table-responsive">
        <table className="table table-sm table-striped">
          <thead>
            <tr>
              <th>When</th>
              <th>Admin</th>
              <th>Field</th>
              <th>Old</th>
              <th>New</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id || `${log.field}-${log.changed_at}`}>
                <td>{log.changed_at || "\u2014"}</td>
                <td>{log.admin_email || "\u2014"}</td>
                <td>{log.field}</td>
                <td>{log.old_value || "\u2014"}</td>
                <td>{log.new_value || "\u2014"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default AuditLogTable;
