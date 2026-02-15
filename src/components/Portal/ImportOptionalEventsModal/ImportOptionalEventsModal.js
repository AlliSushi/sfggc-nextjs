import ImportCsvModal from "../ImportCsvModal/ImportCsvModal";

const ImportOptionalEventsModal = ({
  onClose,
  onComplete,
  endpoint = "/api/portal/admin/optional-events/import",
}) => (
  <ImportCsvModal
    title="Import Optional Events"
    endpoint={endpoint}
    initialStatus="Select an Optional Events CSV file to preview."
    importingStatus="Importing Optional Events..."
    previewFailedMessage="Optional Events import preview failed. Please try again."
    importFailedMessage="Optional Events import failed. Please try again."
    buildCompleteStatus={(summary) =>
      `Optional Events import complete: ${summary.updated} updated, ${summary.unchanged} unchanged`
    }
    warningMessage={(count) => `${count} warning(s) found.`}
    requireMatchesForImport
    noMatchesMessage="No participants matched this CSV. Fix mapping and preview again."
    unmatchedNameLabel="Bowler Name"
    onClose={onClose}
    onComplete={onComplete}
  />
);

export default ImportOptionalEventsModal;
