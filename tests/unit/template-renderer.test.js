const { test } = require("node:test");
const assert = require("node:assert/strict");

const { renderTemplate, PLACEHOLDER_PATTERN } = require("../../src/utils/portal/template-renderer.js");

test(
  "Given a template with {{loginUrl}}, when rendered with loginUrl value, then the placeholder is replaced",
  () => {
    const result = renderTemplate("Click {{loginUrl}}", { loginUrl: "https://example.com" });
    assert.equal(result, "Click https://example.com");
  }
);

test(
  "Given a template with multiple placeholders, when rendered, then all are replaced",
  () => {
    const result = renderTemplate("Hello {{firstName}} {{lastName}}, visit {{loginUrl}}", {
      firstName: "Jane",
      lastName: "Doe",
      loginUrl: "https://example.com",
    });
    assert.equal(result, "Hello Jane Doe, visit https://example.com");
  }
);

test(
  "Given a template with a repeated placeholder, when rendered, then all occurrences are replaced",
  () => {
    const result = renderTemplate("Hi {{firstName}}, welcome {{firstName}}!", {
      firstName: "Jane",
    });
    assert.equal(result, "Hi Jane, welcome Jane!");
  }
);

test(
  "Given a template with an unknown placeholder, when rendered, then it remains as-is",
  () => {
    const result = renderTemplate("Hello {{unknownVar}}", { firstName: "Jane" });
    assert.equal(result, "Hello {{unknownVar}}");
  }
);

test(
  "Given an empty variables object, when rendered, then no placeholders are replaced",
  () => {
    const result = renderTemplate("Hello {{firstName}}", {});
    assert.equal(result, "Hello {{firstName}}");
  }
);

test(
  "Given a null template, when rendered, then empty string is returned",
  () => {
    assert.equal(renderTemplate(null, { firstName: "Jane" }), "");
    assert.equal(renderTemplate(undefined, { firstName: "Jane" }), "");
  }
);

test(
  "Given PLACEHOLDER_PATTERN is exported, when tested against a string, then it matches {{word}} patterns",
  () => {
    const matches = "{{foo}} bar {{baz}}".match(PLACEHOLDER_PATTERN);
    assert.deepEqual(matches, ["{{foo}}", "{{baz}}"]);
  }
);
