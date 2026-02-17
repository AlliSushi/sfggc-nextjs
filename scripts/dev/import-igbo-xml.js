#!/usr/bin/env node
const fs = require("fs");
const { importIgboXml, parsePeople, buildImportRows } = require("../../src/utils/portal/importIgboXml");

const args = process.argv.slice(2);
const getArgValue = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] || null;
};

const xmlPath =
  getArgValue("--file") ||
  getArgValue("-f") ||
  process.env.IGBO_XML_PATH ||
  "/tmp/igbo.xml";
const dryRun = args.includes("--dry-run");

if (!fs.existsSync(xmlPath)) {
  console.error(`XML file not found at ${xmlPath}`);
  process.exit(1);
}

const xml = fs.readFileSync(xmlPath, "utf8");
const people = parsePeople(xml);
const { teams, doubles, peopleRows, scores } = buildImportRows(people);
const summary = {
  people: peopleRows.length,
  teams: teams.length,
  doubles: doubles.length,
  scores: scores.length,
};

if (dryRun) {
  console.log("Dry run summary:", summary);
  process.exit(0);
}

const run = async () => {
  try {
    await importIgboXml(xml);
    console.log("Import complete:", summary);
  } catch (error) {
    console.error("Import failed:", error.message);
    process.exit(1);
  }
};

run();
