const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { initTestDb } = require("../helpers/test-db");

let db;
let dbReady = false;
let dbSkipReason = "";

const loadImporter = async () => {
  const fullPath = path.join(process.cwd(), "src", "utils", "portal", "importIgboXml.js");
  const module = await import(pathToFileURL(fullPath));
  return module.importIgboXml;
};

before(async () => {
  try {
    db = await initTestDb();
    dbReady = true;
  } catch (error) {
    dbReady = false;
    dbSkipReason = error.message;
  }
});

beforeEach(async () => {
  if (!dbReady) return;
  await db.reset();
});

after(async () => {
  if (!dbReady) return;
  await db.close();
});

test("Given XML with doubles pairing, when importing twice, then data upserts", async (t) => {
  if (!dbReady) {
    t.skip(dbSkipReason || "Database not available");
    return;
  }
  const importIgboXml = await loadImporter();
  const xml = `
    <IGBOTS>
      <PEOPLES>
        <PEOPLE>
          <ID>1001</ID>
          <LAST_NAME>Test</LAST_NAME>
          <FIRST_NAME>Alice</FIRST_NAME>
          <EMAIL>alice@example.com</EMAIL>
          <PHONE_1>555-111-2222</PHONE_1>
          <CITY>San Francisco</CITY>
          <STATE>CA</STATE>
          <COUNTRY>US</COUNTRY>
          <BIRTH_DAY>10</BIRTH_DAY>
          <BIRTH_MONTH>03</BIRTH_MONTH>
          <TEAM_ID>3001</TEAM_ID>
          <TEAM_NAME>Team One</TEAM_NAME>
          <DOUBLES_EXTERNAL_ID>1002</DOUBLES_EXTERNAL_ID>
          <DOUBLES_FIRST_NAME>Bob</DOUBLES_FIRST_NAME>
          <DOUBLES_LAST_NAME>Partner</DOUBLES_LAST_NAME>
          <BOOK_AVERAGE>150</BOOK_AVERAGE>
        </PEOPLE>
        <PEOPLE>
          <ID>1002</ID>
          <LAST_NAME>Partner</LAST_NAME>
          <FIRST_NAME>Bob</FIRST_NAME>
          <EMAIL>bob@example.com</EMAIL>
          <PHONE_1>555-333-4444</PHONE_1>
          <CITY>San Francisco</CITY>
          <STATE>CA</STATE>
          <COUNTRY>US</COUNTRY>
          <BIRTH_DAY>12</BIRTH_DAY>
          <BIRTH_MONTH>04</BIRTH_MONTH>
          <TEAM_ID>3001</TEAM_ID>
          <TEAM_NAME>Team One</TEAM_NAME>
          <DOUBLES_EXTERNAL_ID>1001</DOUBLES_EXTERNAL_ID>
          <DOUBLES_FIRST_NAME>Alice</DOUBLES_FIRST_NAME>
          <DOUBLES_LAST_NAME>Test</DOUBLES_LAST_NAME>
          <BOOK_AVERAGE>160</BOOK_AVERAGE>
        </PEOPLE>
      </PEOPLES>
    </IGBOTS>
  `;

  const first = await importIgboXml(xml);
  const second = await importIgboXml(xml);

  const { rows: peopleRows } = await db.pool.query("select pid from people");
  const { rows: doublesRows } = await db.pool.query(
    "select pid, partner_pid, did from doubles_pairs order by pid"
  );
  const { rows: didRows } = await db.pool.query(
    "select distinct did from doubles_pairs"
  );

  assert.equal(first.people, 2);
  assert.equal(first.teams, 1);
  assert.equal(first.doubles, 2);
  assert.equal(second.people, 2);
  assert.equal(peopleRows.length, 2);
  assert.equal(doublesRows.length, 2);
  assert.equal(didRows.length, 2);
  assert.equal(doublesRows[0].partner_pid, "1002");
});

test(
  "Given an admin tied to a participant, when importing XML, then admin contact info stays in sync",
  async (t) => {
    if (!dbReady) {
      t.skip(dbSkipReason || "Database not available");
      return;
    }
    const importIgboXml = await loadImporter();
    await db.pool.query(
      `
      create table if not exists admins (
        id char(36) primary key default (uuid()),
        email text unique not null,
        name text,
        pid text,
        first_name text,
        last_name text,
        phone text unique,
        password_hash text,
        role text not null default 'super-admin',
        created_at timestamp default current_timestamp
      )
      `
    );
    await db.pool.query(
      `
      insert into admins (email, name, pid, first_name, last_name, phone, password_hash, role)
      values (?,?,?,?,?,?,?,?)
      `,
      [
        "old-email@example.com",
        "Old Name",
        "1001",
        "Old",
        "Name",
        "555-999-0000",
        "hash",
        "super-admin",
      ]
    );

    const xml = `
      <IGBOTS>
        <PEOPLES>
          <PEOPLE>
            <ID>1001</ID>
            <LAST_NAME>Updated</LAST_NAME>
            <FIRST_NAME>Admin</FIRST_NAME>
            <EMAIL>admin@example.com</EMAIL>
            <PHONE_1>555-111-2222</PHONE_1>
            <CITY>San Francisco</CITY>
            <STATE>CA</STATE>
            <COUNTRY>US</COUNTRY>
            <BIRTH_DAY>10</BIRTH_DAY>
            <BIRTH_MONTH>03</BIRTH_MONTH>
            <TEAM_ID>3001</TEAM_ID>
            <TEAM_NAME>Team One</TEAM_NAME>
          </PEOPLE>
        </PEOPLES>
      </IGBOTS>
    `;

    await importIgboXml(xml);

    const { rows } = await db.pool.query(
      "select email, first_name, last_name, phone from admins where pid = ?",
      ["1001"]
    );

    assert.equal(rows[0].email, "admin@example.com");
    assert.equal(rows[0].first_name, "Admin");
    assert.equal(rows[0].last_name, "Updated");
    assert.equal(rows[0].phone, "555-111-2222");
  }
);
