import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const scriptPath = path.join(
  process.cwd(),
  "scripts",
  "admin",
  "create-super-admin.sh"
);

test("Given missing ADMIN_EMAIL, when running bootstrap, then exit non-zero", () => {
  const result = spawnSync("bash", [scriptPath], {
    env: {
      PATH: process.env.PATH,
    },
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /ADMIN_EMAIL/);
});

test("Given participant-only flag, when running bootstrap, then skip DB if requested", () => {
  const result = spawnSync("bash", [scriptPath, "--participant-only"], {
    env: {
      PATH: process.env.PATH,
      ADMIN_EMAIL: "dev-admin@example.com",
      PORTAL_DATABASE_URL: "mysql://localhost:3306/dev",
      SKIP_DB: "true",
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Skipping database operations/);
});

test("Given missing ADMIN_PASSWORD, when creating admin, then exit non-zero", () => {
  const result = spawnSync("bash", [scriptPath], {
    env: {
      PATH: process.env.PATH,
      ADMIN_EMAIL: "admin@example.com",
      ADMIN_NAME: "Admin User",
      PORTAL_DATABASE_URL: "mysql://localhost:3306/dev",
    },
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /ADMIN_PASSWORD/);
});

test("Given SKIP_DB, when creating admin, then exit zero", () => {
  const result = spawnSync("bash", [scriptPath], {
    env: {
      PATH: process.env.PATH,
      ADMIN_EMAIL: "admin@example.com",
      ADMIN_NAME: "Admin User",
      ADMIN_PASSWORD: "test123",
      PORTAL_DATABASE_URL: "mysql://localhost:3306/dev",
      SKIP_DB: "true",
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Skipping database operations/);
});
