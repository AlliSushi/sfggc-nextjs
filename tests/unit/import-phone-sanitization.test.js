const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const IMPORT_IGBO_XML = path.join(
  process.cwd(),
  "src/utils/portal/importIgboXml.js"
);

describe("Phone number sanitization in XML import", () => {
  test("Given importIgboXml module, when checking sanitization logic, then sanitizePhone function exists", () => {
    const src = fs.readFileSync(IMPORT_IGBO_XML, "utf-8");

    // Should have sanitizePhone function
    assert.match(src, /const sanitizePhone = /);
    assert.match(src, /sanitizePhone\(/);
  });

  test("Given importIgboXml module, when checking phone extraction, then sanitizePhone is used instead of toText", () => {
    const src = fs.readFileSync(IMPORT_IGBO_XML, "utf-8");

    // Should use sanitizePhone for phone field
    assert.match(src, /const phone = sanitizePhone\(person\.PHONE_1 \|\| person\.PHONE\)/);

    // Should NOT use toText for phone field (regression check)
    const phoneLineMatch = src.match(/const phone = (.*?);/);
    assert.ok(phoneLineMatch, "Should have 'const phone =' line");
    assert.match(phoneLineMatch[1], /sanitizePhone/, "Phone should use sanitizePhone, not toText");
  });

  test("Given sanitizePhone function, when checking implementation, then it removes invisible Unicode formatting characters", () => {
    const src = fs.readFileSync(IMPORT_IGBO_XML, "utf-8");

    // Extract the sanitizePhone function
    const functionMatch = src.match(/const sanitizePhone = \(value\) => \{[\s\S]*?^};/m);
    assert.ok(functionMatch, "sanitizePhone function should exist");

    const functionBody = functionMatch[0];

    // Should remove U+202C (POP DIRECTIONAL FORMATTING) - the character causing production issue
    assert.match(functionBody, /\\u202[A-F]/i, "Should handle U+202x directional formatting characters");

    // Should remove U+200E/U+200F (LTR/RTL marks)
    assert.match(functionBody, /\\u200[EF]/i, "Should handle U+200E/U+200F marks");

    // Should use regex replace to remove characters
    assert.match(functionBody, /\.replace\(/);
  });

  test("Given sanitizePhone function, when checking documentation, then it explains the purpose and lists removed characters", () => {
    const src = fs.readFileSync(IMPORT_IGBO_XML, "utf-8");

    // Extract JSDoc comment before sanitizePhone
    const commentMatch = src.match(/\/\*\*[\s\S]*?\*\/\s*const sanitizePhone/);
    assert.ok(commentMatch, "sanitizePhone should have JSDoc comment");

    const comment = commentMatch[0];

    // Should document the database encoding issue
    assert.match(comment, /encoding/i, "Should explain encoding issue");
    assert.match(comment, /database/i, "Should mention database");

    // Should list U+202C specifically (the character from production bug)
    assert.match(comment, /U\+202C/i, "Should document U+202C character");
    assert.match(comment, /POP DIRECTIONAL FORMATTING/i, "Should document POP DIRECTIONAL FORMATTING");
  });
});
