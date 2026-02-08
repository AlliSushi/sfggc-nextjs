import fs from "fs";
import path from "path";
import { parseCSV } from "../../../src/utils/portal/csv.js";

const EVENT_ENTRIES_FILE = "SFGGC Sample Table - EventEntries.csv";

const resolveSampleDataDir = () => {
  const portalDocsPath = path.join(
    process.cwd(),
    "portal_docs",
    "sample_data"
  );
  const legacyPath = path.join(process.cwd(), "sample_data");

  if (fs.existsSync(portalDocsPath)) {
    return portalDocsPath;
  }

  return legacyPath;
};

const readEventEntries = () => {
  const dataDir = resolveSampleDataDir();
  const filePath = path.join(dataDir, EVENT_ENTRIES_FILE);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return parseCSV(raw);
};

const toNumber = (value) => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const buildIndex = (entries) => {
  const index = new Map();
  entries.forEach((entry) => index.set(entry.PID, entry));
  return index;
};

const mapScores = (entry, prefix) => {
  return [
    toNumber(entry[`${prefix}_Gm1`]),
    toNumber(entry[`${prefix}_Gm2`]),
    toNumber(entry[`${prefix}_Gm3`]),
  ].filter((value) => value !== null);
};

const buildParticipant = (entry, index) => {
  if (!entry) {
    return null;
  }

  const partner = index.get(entry.PartnerID);

  return {
    pid: entry.PID,
    firstName: entry.FirstName,
    lastName: entry.LastName,
    email: entry.Email,
    team: {
      tnmtId: entry.TID,
      name: entry.Team_Name,
    },
    doubles: {
      did: entry.DID,
      partnerPid: entry.PartnerID,
      partnerName: partner ? `${partner.FirstName} ${partner.LastName}` : null,
    },
    lanes: {
      team: entry.T_Lane,
      doubles: entry.D_Lane,
      singles: entry.S_Lane,
    },
    averages: {
      entering: toNumber(entry.Avg),
      handicap: toNumber(entry.Hdcp),
    },
    scores: {
      team: mapScores(entry, "T"),
      doubles: mapScores(entry, "D"),
      singles: mapScores(entry, "S"),
    },
  };
};

const getAllParticipants = () => {
  const entries = readEventEntries();
  const index = buildIndex(entries);
  return entries.map((entry) => buildParticipant(entry, index));
};

const getParticipantByPid = (pid) => {
  const entries = readEventEntries();
  const index = buildIndex(entries);
  return buildParticipant(index.get(pid), index);
};

export { getAllParticipants, getParticipantByPid };
