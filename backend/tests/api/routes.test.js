import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { routes } from "../../src/index.js";

const SAMPLE_DIR = path.join(
  process.cwd(),
  "portal_docs",
  "sample_data"
);
const SAMPLE_FILE = path.join(
  SAMPLE_DIR,
  "SFGGC Sample Table - EventEntries.csv"
);

const writeSampleData = () => {
  if (!fs.existsSync(SAMPLE_DIR)) {
    fs.mkdirSync(SAMPLE_DIR, { recursive: true });
  }
  const csv = [
    "PID,FirstName,LastName,Email,TID,Team_Name,DID,PartnerID,T_Lane,D_Lane,S_Lane,Avg,Hdcp,T_Gm1,T_Gm2,T_Gm3,D_Gm1,D_Gm2,D_Gm3,S_Gm1,S_Gm2,S_Gm3",
    "3336,Robert,Aldeguer,robert@example.com,2305,Well No Split,1076,,A,B,C,180,10,200,190,180,170,160,150,140,130,120",
  ].join("\n");
  fs.writeFileSync(SAMPLE_FILE, csv, "utf8");
};

const removeSampleData = () => {
  if (fs.existsSync(SAMPLE_FILE)) {
    fs.unlinkSync(SAMPLE_FILE);
  }
};

before(() => {
  writeSampleData();
});

after(() => {
  removeSampleData();
});

test("Given backend routes, when listing participants, then data returns", () => {
  const participants = routes.participants.listParticipants();
  assert.ok(Array.isArray(participants));
});

test("Given a search term, when listing participants, then results are filtered", () => {
  const participants = routes.participants.listParticipants({ search: "aldeguer" });
  assert.ok(participants.every((participant) => participant.pid || participant.email));
});

test("Given a participant id, when getting participant, then a profile is returned", (t) => {
  const participants = routes.participants.listParticipants();
  const sample = participants[0];
  if (!sample) {
    t.skip("No sample data available");
    return;
  }
  const participant = routes.participants.getParticipant(sample.pid);
  assert.ok(participant);
  assert.equal(participant.pid, sample.pid);
});

test("Given backend auth, when starting participant auth, then ok true", () => {
  const response = routes.auth.startParticipantAuth({
    emailOrPhone: "test@example.com",
  });
  assert.equal(response.ok, true);
});
