import nodemailer from "nodemailer";
import { query as defaultQuery } from "./db.js";
import {
  initializeEmailTemplates,
  getTemplateBySlug,
} from "./email-templates-db.js";
import { renderTemplate } from "./template-renderer.js";
import { resolveTemplateHtml, resolveTemplateText } from "./email-html-builder.js";

const BASE_URL = process.env.PORTAL_BASE_URL || "http://localhost:3000";

const smtpConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const buildVerifyUrl = (token) =>
  `${BASE_URL}/api/portal/participant/verify?token=${token}`;

const buildAdminLoginUrl = () => `${BASE_URL}/portal/`;

const getTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

const sendTemplatedEmail = async ({ to, slug, variables, buttonUrl, query = defaultQuery, transport }) => {
  await initializeEmailTemplates(query);

  const template = await getTemplateBySlug(slug, query);
  if (!template) {
    console.log(`[email] No template found for slug "${slug}" — skipping send.`);
    return;
  }

  const renderedSubject = renderTemplate(template.subject, variables);
  const rawHtml = resolveTemplateHtml(template, { buttonUrl });
  const rawText = resolveTemplateText(template, { buttonUrl });
  const renderedHtml = renderTemplate(rawHtml, variables);
  const renderedText = renderTemplate(rawText, variables);

  if (!transport && !smtpConfigured()) {
    console.log(`[email] No SMTP configured — would send "${slug}" to ${to}`);
    console.log(`[email] Subject: ${renderedSubject}`);
    return;
  }

  const sender = transport || getTransporter();
  await sender.sendMail({
    from: process.env.SMTP_FROM || "Golden Gate Classic <noreply@goldengateclassic.org>",
    to,
    subject: renderedSubject,
    text: renderedText,
    html: renderedHtml,
  });
};

const sendLoginEmail = async ({ email, token, query }) => {
  const url = buildVerifyUrl(token);
  await sendTemplatedEmail({
    to: email,
    slug: "participant-login",
    variables: { loginUrl: url, email },
    buttonUrl: url,
    query,
  });
};

const sendAdminWelcomeEmail = async ({ email, firstName, lastName, password, query }) => {
  const loginUrl = buildAdminLoginUrl();
  await sendTemplatedEmail({
    to: email,
    slug: "admin-welcome",
    variables: { firstName, lastName, email, password, loginUrl },
    buttonUrl: loginUrl,
    query,
  });
};

export {
  sendLoginEmail,
  sendAdminWelcomeEmail,
  sendTemplatedEmail,
  buildVerifyUrl,
  smtpConfigured,
};
