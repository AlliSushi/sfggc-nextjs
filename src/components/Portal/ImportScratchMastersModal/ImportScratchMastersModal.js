import ImportCsvModal from "../ImportCsvModal/ImportCsvModal";

const ImportScratchMastersModal = ({ onClose, onComplete }) => (
  <ImportCsvModal
    title="Import Scratch Masters"
    endpoint="/api/portal/admin/scratch-masters/import"
    initialStatus="Select a Scratch Masters CSV file to preview."
    importingStatus="Importing Scratch Masters..."
    previewFailedMessage="Scratch Masters import preview failed. Please try again."
    importFailedMessage="Scratch Masters import failed. Please try again."
    buildCompleteStatus={(summary) =>
      `Scratch Masters import complete: ${summary.updated} updated, ${summary.unchanged} unchanged`
    }
    warningMessage={(count) => `${count} warning(s) found. Identical duplicates were deduped.`}
    unmatchedNameLabel="Bowler Name"
    onClose={onClose}
    onComplete={onComplete}
  />
);

export default ImportScratchMastersModal;
