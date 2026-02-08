import crypto from "crypto";
import { query as defaultQuery } from "./db.js";

const ensureEmailTemplatesTable = async (q = defaultQuery) => {
  await q(`
    create table if not exists email_templates (
      id char(36) primary key,
      slug varchar(128) not null unique,
      name varchar(255) not null,
      subject text not null,
      greeting text,
      body text,
      button_text text,
      footer text,
      html_override text,
      use_html_override boolean default false,
      available_variables text,
      created_at timestamp default current_timestamp,
      updated_at timestamp default current_timestamp on update current_timestamp
    )
  `);
};

const getTemplateBySlug = async (slug, q = defaultQuery) => {
  const { rows } = await q("select * from email_templates where slug = ?", [slug]);
  return rows[0] || null;
};

const getAllTemplates = async (q = defaultQuery) => {
  const { rows } = await q("select * from email_templates order by name");
  return rows;
};

const upsertTemplate = async (data, q = defaultQuery) => {
  await q(
    `
    insert into email_templates (id, slug, name, subject, greeting, body, button_text, footer, html_override, use_html_override, available_variables)
    values (?,?,?,?,?,?,?,?,?,?,?)
    on duplicate key update
      name = values(name),
      subject = values(subject),
      greeting = values(greeting),
      body = values(body),
      button_text = values(button_text),
      footer = values(footer),
      html_override = values(html_override),
      use_html_override = values(use_html_override),
      available_variables = values(available_variables),
      updated_at = now()
    `,
    [
      crypto.randomUUID(),
      data.slug,
      data.name,
      data.subject,
      data.greeting || "",
      data.body || "",
      data.button_text || "",
      data.footer || "",
      data.html_override || "",
      data.use_html_override ? 1 : 0,
      data.available_variables || "[]",
    ]
  );
};

const DEFAULT_TEMPLATES = [
  {
    slug: "participant-login",
    name: "Participant Login",
    subject: "Your Golden Gate Classic login link",
    greeting: "Golden Gate Classic",
    body: "Click the link below to sign in to the tournament portal:",
    button_text: "Sign in to the portal",
    footer:
      "This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.",
    html_override: "",
    use_html_override: false,
    available_variables: '["loginUrl","firstName","email"]',
  },
  {
    slug: "admin-welcome",
    name: "Admin Welcome",
    subject: "Your Golden Gate Classic admin account",
    greeting: "Welcome, {{firstName}}!",
    body: "An admin account has been created for you on the Golden Gate Classic tournament portal.\n\nYour temporary password is: {{password}}\n\nPlease change your password after your first login.",
    button_text: "Sign in to the portal",
    footer:
      "If you did not expect this email, please contact the tournament organizer.",
    html_override: "",
    use_html_override: false,
    available_variables: '["firstName","lastName","email","password","loginUrl"]',
  },
];

const seedDefaultTemplates = async (q = defaultQuery) => {
  for (const tmpl of DEFAULT_TEMPLATES) {
    const existing = await getTemplateBySlug(tmpl.slug, q);
    if (!existing) {
      await upsertTemplate(tmpl, q);
    }
  }
};

let initialized = false;
const initializeEmailTemplates = async (queryFn = defaultQuery) => {
  if (initialized) return;
  await ensureEmailTemplatesTable(queryFn);
  await seedDefaultTemplates(queryFn);
  initialized = true;
};

export {
  ensureEmailTemplatesTable,
  getTemplateBySlug,
  getAllTemplates,
  upsertTemplate,
  seedDefaultTemplates,
  initializeEmailTemplates,
  DEFAULT_TEMPLATES,
};
