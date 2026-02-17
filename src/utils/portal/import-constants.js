const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024;

const IMPORT_MODES = {
  PREVIEW: "preview",
  IMPORT: "import",
};

const isImportMode = (mode) =>
  mode === IMPORT_MODES.PREVIEW || mode === IMPORT_MODES.IMPORT;

export { MAX_CSV_SIZE_BYTES, IMPORT_MODES, isImportMode };
