import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ensureEmailTemplatesTable,
  getTemplateBySlug,
  getAllTemplates,
  upsertTemplate,
  seedDefaultTemplates,
  DEFAULT_TEMPLATES,
} from "../../src/utils/portal/email-templates-db.js";

const buildMockQuery = (resultsFn) => {
  const calls = [];
  const mockQuery = async (sql, params = []) => {
    calls.push({ sql: sql.trim(), params });
    if (resultsFn) return resultsFn(sql, params, calls.length);
    return { rows: [] };
  };
  mockQuery.calls = calls;
  return mockQuery;
};

test(
  "Given ensureEmailTemplatesTable is called, when executing, then it creates the email_templates table",
  async () => {
    const mockQuery = buildMockQuery();
    await ensureEmailTemplatesTable(mockQuery);
    const createCall = mockQuery.calls.find((c) =>
      c.sql.includes("create table if not exists email_templates")
    );
    assert.ok(createCall, "Should execute CREATE TABLE for email_templates");
  }
);

test(
  "Given getTemplateBySlug with a known slug, when called, then it returns the template row",
  async () => {
    const row = { id: "abc", slug: "participant-login", subject: "Test" };
    const mockQuery = buildMockQuery(() => ({ rows: [row] }));
    const result = await getTemplateBySlug("participant-login", mockQuery);
    assert.deepEqual(result, row);
    assert.ok(
      mockQuery.calls[0].params.includes("participant-login"),
      "Should query by slug parameter"
    );
  }
);

test(
  "Given getTemplateBySlug with an unknown slug, when called, then it returns null",
  async () => {
    const mockQuery = buildMockQuery(() => ({ rows: [] }));
    const result = await getTemplateBySlug("nonexistent", mockQuery);
    assert.equal(result, null);
  }
);

test(
  "Given getAllTemplates, when called, then it returns all template rows",
  async () => {
    const rows = [{ slug: "a" }, { slug: "b" }];
    const mockQuery = buildMockQuery(() => ({ rows }));
    const result = await getAllTemplates(mockQuery);
    assert.deepEqual(result, rows);
  }
);

test(
  "Given upsertTemplate with data, when called, then it performs an insert-on-duplicate-key-update",
  async () => {
    const mockQuery = buildMockQuery();
    await upsertTemplate(
      {
        slug: "participant-login",
        name: "Participant Login",
        subject: "Login",
        greeting: "Hi",
        body: "Click here",
        button_text: "Sign in",
        footer: "Bye",
        html_override: "",
        use_html_override: false,
        available_variables: '["loginUrl"]',
      },
      mockQuery
    );
    const upsertCall = mockQuery.calls[0];
    assert.ok(
      upsertCall.sql.includes("insert into email_templates") &&
        upsertCall.sql.includes("on duplicate key update"),
      "Should use INSERT ... ON DUPLICATE KEY UPDATE"
    );
  }
);

test(
  "Given seedDefaultTemplates, when called with no existing templates, then it inserts default templates",
  async () => {
    const mockQuery = buildMockQuery(() => ({ rows: [] }));
    await seedDefaultTemplates(mockQuery);
    const insertCalls = mockQuery.calls.filter((c) =>
      c.sql.includes("insert into email_templates")
    );
    assert.ok(insertCalls.length >= 2, "Should insert at least 2 default templates");
  }
);

test(
  "Given DEFAULT_TEMPLATES is exported, when checked, then it includes participant-login and admin-welcome",
  () => {
    const slugs = DEFAULT_TEMPLATES.map((t) => t.slug);
    assert.ok(slugs.includes("participant-login"), "Should include participant-login");
    assert.ok(slugs.includes("admin-welcome"), "Should include admin-welcome");
  }
);
