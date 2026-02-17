const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Linter } = require("eslint");

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
      },
    },
    filePath
  );
  return messages.filter((message) => message.ruleId === "no-undef");
};

test(
  "Given portal admin pages, when linting for undefined vars, then none are reported",
  () => {
    const filesToCheck = ["src/pages/portal/admin/admins/index.js"];
    const errors = filesToCheck.flatMap((relativePath) => {
      const fullPath = path.join(process.cwd(), relativePath);
      const messages = lintNoUndef(fullPath);
      return messages.map(
        (message) =>
          `${relativePath}:${message.line}:${message.column} ${message.message}`
      );
    });

    assert.equal(
      errors.length,
      0,
      `Undefined variables found:\n${errors.join("\n")}`
    );
  }
);
