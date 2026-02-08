const assembleHtml = ({ greeting, body, buttonText, buttonUrl, footer }) => {
  const greetingHtml = greeting ? `<h2>${greeting}</h2>` : "";
  const bodyHtml = body ? `<p>${body.replace(/\n/g, "<br>")}</p>` : "";
  const buttonHtml =
    buttonText && buttonUrl
      ? `<p style="margin: 24px 0;">
    <a href="${buttonUrl}" style="background: #0d6efd; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
      ${buttonText}
    </a>
  </p>`
      : "";
  const footerHtml = footer
    ? `<p style="color: #666; font-size: 14px;">${footer}</p>`
    : "";

  return `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
  ${greetingHtml}
  ${bodyHtml}
  ${buttonHtml}
  ${footerHtml}
</div>`;
};

const assembleText = ({ greeting, body, buttonText, buttonUrl, footer }) => {
  const parts = [];
  if (greeting) parts.push(greeting);
  if (body) parts.push(body);
  if (buttonUrl) parts.push(buttonUrl);
  if (footer) parts.push(footer);
  return parts.join("\n\n");
};

const resolveTemplateHtml = (templateRow, { buttonUrl } = {}) => {
  if (templateRow.use_html_override && templateRow.html_override) {
    return templateRow.html_override;
  }
  return assembleHtml({
    greeting: templateRow.greeting,
    body: templateRow.body,
    buttonText: templateRow.button_text,
    buttonUrl,
    footer: templateRow.footer,
  });
};

const resolveTemplateText = (templateRow, { buttonUrl } = {}) => {
  if (templateRow.use_html_override && templateRow.html_override) {
    return templateRow.html_override.replace(/<[^>]+>/g, "");
  }
  return assembleText({
    greeting: templateRow.greeting,
    body: templateRow.body,
    buttonText: templateRow.button_text,
    buttonUrl,
    footer: templateRow.footer,
  });
};

export { assembleHtml, assembleText, resolveTemplateHtml, resolveTemplateText };
