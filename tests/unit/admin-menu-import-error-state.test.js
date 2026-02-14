const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Linter } = require("eslint");

const ADMIN_MENU_PATH = path.join(
  process.cwd(),
  "src/components/Portal/AdminMenu/AdminMenu.js"
);

const lintNoUndef = (filePath) => {
  const code = fs.readFileSync(filePath, "utf8");
  const linter = new Linter();
  const messages = linter.verify(
    code,
    {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      rules: {
        "no-undef": "error",
      },
      globals: {
        window: "readonly",
        fetch: "readonly",
        FormData: "readonly",
      },
    },
    filePath
  );
  return messages.filter((message) => message.ruleId === "no-undef");
};

test(
  "Given AdminMenu import error handling, when linting for undefined identifiers, then no stale error state setter is referenced",
  () => {
    const errors = lintNoUndef(ADMIN_MENU_PATH).map(
      (message) =>
        `${message.line}:${message.column} ${message.message}`
    );

    assert.equal(
      errors.length,
      0,
      `Undefined variables found in AdminMenu:\n${errors.join("\n")}`
    );
  }
);
