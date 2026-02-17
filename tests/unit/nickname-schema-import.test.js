const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PORTAL_SCHEMA = path.join(process.cwd(), "portal_docs/sql/portal_schema.sql");
const IMPORT_IGBO_XML = path.join(process.cwd(), "src/utils/portal/importIgboXml.js");

describe("Nickname database schema", () => {
  test("Given people table schema, when checking columns, then nickname field exists", () => {
    const schema = fs.readFileSync(PORTAL_SCHEMA, "utf-8");

    // Find people table definition
    const peopleTableMatch = schema.match(/create table if not exists people[\s\S]*?\);/i);
    assert.ok(peopleTableMatch, "people table must exist in schema");

    const peopleTable = peopleTableMatch[0];

    // Must have nickname column
    assert.ok(
      peopleTable.includes("nickname"),
      "people table must have nickname column"
    );

    // nickname should be text type (like first_name and last_name)
    assert.ok(
      peopleTable.match(/nickname\s+text/i),
      "nickname column must be text type"
    );
  });

  test("Given people table schema, when checking nickname column, then it appears after last_name", () => {
    const schema = fs.readFileSync(PORTAL_SCHEMA, "utf-8");

    const peopleTableMatch = schema.match(/create table if not exists people[\s\S]*?\);/i);
    const peopleTable = peopleTableMatch[0];

    // Find positions of columns
    const firstNamePos = peopleTable.indexOf("first_name");
    const lastNamePos = peopleTable.indexOf("last_name");
    const nicknamePos = peopleTable.indexOf("nickname");

    // Logical ordering: first_name, last_name, nickname
    assert.ok(
      firstNamePos < lastNamePos && lastNamePos < nicknamePos,
      "nickname column should appear after first_name and last_name"
    );
  });
});

describe("Nickname XML import", () => {
  test("Given importIgboXml module, when checking person extraction, then NICKNAME field is extracted", () => {
    const src = fs.readFileSync(IMPORT_IGBO_XML, "utf-8");

    // Should extract NICKNAME field from XML
    assert.ok(
      src.includes("NICKNAME") || src.includes("nickname"),
      "importIgboXml must extract NICKNAME field from XML"
    );
  });

  test("Given importIgboXml module, when checking sanitization, then nickname uses sanitizePhone for Unicode cleanup", () => {
    const src = fs.readFileSync(IMPORT_IGBO_XML, "utf-8");

    // NICKNAME should use same sanitization as phone (to remove Unicode formatting)
    // Look for nickname extraction logic
    const nicknameExtraction = src.match(/nickname.*=.*person\.(NICKNAME|nickname)/i);
    assert.ok(nicknameExtraction, "Should extract nickname from person data");

    // Should use sanitizePhone or similar function to clean Unicode characters
    assert.ok(
      src.match(/nickname.*sanitizePhone/i) || src.match(/sanitizePhone.*nickname/i),
      "nickname should use sanitizePhone to remove Unicode formatting characters"
    );
  });

  test("Given importIgboXml module, when upserting person, then nickname is included in INSERT", () => {
    const src = fs.readFileSync(IMPORT_IGBO_XML, "utf-8");

    // Find the INSERT INTO people statement
    const insertMatch = src.match(/insert into people[\s\S]{0,500}values/i);
    assert.ok(insertMatch, "Should have INSERT INTO people statement");

    const insertStatement = insertMatch[0];

    // nickname should be in the column list
    assert.ok(
      insertStatement.includes("nickname"),
      "INSERT INTO people must include nickname column"
    );
  });

  test("Given importIgboXml module, when upserting person, then nickname is included in ON DUPLICATE KEY UPDATE", () => {
    const src = fs.readFileSync(IMPORT_IGBO_XML, "utf-8");

    // Find the people table's ON DUPLICATE KEY UPDATE section
    const updateMatch = src.match(/insert into people[\s\S]{0,1000}on duplicate key update[\s\S]{0,500}/i);
    assert.ok(updateMatch, "Should have ON DUPLICATE KEY UPDATE clause for people table");

    const updateClause = updateMatch[0];

    // nickname should be updated
    assert.ok(
      updateClause.includes("nickname"),
      "ON DUPLICATE KEY UPDATE must include nickname = values(nickname)"
    );
  });
});
