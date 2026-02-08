const importResults = ({ source, fileId }) => {
  return {
    ok: true,
    status: "queued",
    source,
    fileId,
  };
};

export { importResults };
