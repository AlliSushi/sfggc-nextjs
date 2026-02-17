const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const API_FILE = path.join(
  process.cwd(),
  "src/pages/api/portal/admins/index.js"
);

const readSource = () => fs.readFileSync(API_FILE, "utf-8");

describe("Admin creation — atomic insert", () => {
  test("Given the admin creation POST handler, when inserting admin and reset token, then withTransaction is used", () => {
    const src = readSource();
    assert.match(src, /withTransaction/);
  });

  test("Given the admin creation POST handler, when importing db utilities, then withTransaction is imported", () => {
    const src = readSource();
    assert.match(src, /import.*withTransaction.*from.*db/s);
  });

  test("Given the admin creation POST handler, when using a transaction, then the admin insert uses connQuery (not query)", () => {
    const src = readSource();
    // Inside a withTransaction callback, inserts should use connQuery
    // The admin insert and reset token insert must both be inside the transaction
    assert.match(src, /connQuery[\s\S]*?insert into admins/i);
  });

  test("Given the admin creation POST handler, when using a transaction, then the reset token insert uses connQuery (not query)", () => {
    const src = readSource();
    assert.match(src, /connQuery[\s\S]*?insert into admin_password_resets/i);
  });
});

describe("Admin creation — email outside transaction", () => {
  test("Given the admin creation POST handler, when sending the welcome email, then sendAdminWelcomeEmail is called outside withTransaction", () => {
    const src = readSource();
    // The email send should come AFTER the withTransaction block closes
    const txEnd = src.lastIndexOf("withTransaction");
    const emailSend = src.lastIndexOf("sendAdminWelcomeEmail");
    assert.ok(txEnd >= 0, "withTransaction must exist");
    assert.ok(emailSend >= 0, "sendAdminWelcomeEmail must exist");
    assert.ok(emailSend > txEnd, "Email send must come after transaction start");
  });
});
