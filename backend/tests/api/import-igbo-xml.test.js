import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

test("Given an XML file, when running importer in dry-run, then summary is printed", () => {
  const scriptPath = path.join(
    process.cwd(),
    "..",
    "scripts",
    "dev",
    "import-igbo-xml.js"
  );
  const fixturePath = path.join(process.cwd(), "tests", "fixtures", "igbo-small.xml");

  const result = spawnSync("node", [scriptPath, "--file", fixturePath, "--dry-run"], {
    env: {
      PATH: process.env.PATH,
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Dry run summary/);
  assert.match(result.stdout, /people/);
});

test("Given a missing XML file, when running importer, then exit non-zero", () => {
  const scriptPath = path.join(
    process.cwd(),
    "..",
    "scripts",
    "dev",
    "import-igbo-xml.js"
  );
  const result = spawnSync("node", [scriptPath, "--file", "/tmp/missing.xml"], {
    env: {
      PATH: process.env.PATH,
    },
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /XML file not found/);
});
