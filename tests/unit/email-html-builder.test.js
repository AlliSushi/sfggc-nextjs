import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assembleHtml,
  assembleText,
  resolveTemplateHtml,
  resolveTemplateText,
} from "../../src/utils/portal/email-html-builder.js";

test(
  "Given structured fields with a greeting, when assembleHtml is called, then the HTML contains the greeting",
  () => {
    const html = assembleHtml({ greeting: "Golden Gate Classic", body: "Hello", footer: "" });
    assert.ok(html.includes("Golden Gate Classic"), "HTML should contain the greeting");
  }
);

test(
  "Given structured fields with button_text and buttonUrl, when assembleHtml is called, then HTML contains an anchor tag",
  () => {
    const html = assembleHtml({
      greeting: "Hi",
      body: "Click below",
      buttonText: "Sign in",
      buttonUrl: "https://example.com",
      footer: "",
    });
    assert.ok(html.includes('href="https://example.com"'), "HTML should contain button URL");
    assert.ok(html.includes("Sign in"), "HTML should contain button text");
  }
);

test(
  "Given structured fields with a footer, when assembleHtml is called, then HTML contains the footer text",
  () => {
    const html = assembleHtml({ greeting: "", body: "", footer: "Expires in 30 minutes." });
    assert.ok(html.includes("Expires in 30 minutes."), "HTML should contain footer");
  }
);

test(
  "Given structured fields with body containing newlines, when assembleHtml is called, then newlines become <br> tags",
  () => {
    const html = assembleHtml({ greeting: "", body: "Line one\nLine two", footer: "" });
    assert.ok(html.includes("Line one<br>Line two"), "Newlines should be converted to <br>");
  }
);

test(
  "Given a template row with use_html_override=true, when resolveTemplateHtml is called, then it returns the html_override",
  () => {
    const row = {
      use_html_override: true,
      html_override: "<p>Custom HTML</p>",
      greeting: "Ignored",
      body: "Ignored",
      button_text: "Ignored",
      footer: "Ignored",
    };
    const result = resolveTemplateHtml(row, { buttonUrl: "https://example.com" });
    assert.equal(result, "<p>Custom HTML</p>");
  }
);

test(
  "Given a template row with use_html_override=false, when resolveTemplateHtml is called, then it assembles HTML from structured fields",
  () => {
    const row = {
      use_html_override: false,
      html_override: "<p>Unused override</p>",
      greeting: "Hello",
      body: "Welcome",
      button_text: "Click",
      footer: "Bye",
    };
    const result = resolveTemplateHtml(row, { buttonUrl: "https://example.com" });
    assert.ok(result.includes("Hello"), "Should use greeting from structured fields");
    assert.ok(result.includes("Welcome"), "Should use body from structured fields");
    assert.ok(!result.includes("Unused override"), "Should not use html_override");
  }
);

test(
  "Given structured fields, when assembleText is called, then it returns a plain-text version",
  () => {
    const text = assembleText({
      greeting: "Golden Gate Classic",
      body: "Click the link below.",
      buttonText: "Sign in",
      buttonUrl: "https://example.com",
      footer: "This link expires.",
    });
    assert.ok(text.includes("Golden Gate Classic"), "Text should contain greeting");
    assert.ok(text.includes("Click the link below."), "Text should contain body");
    assert.ok(text.includes("https://example.com"), "Text should contain button URL");
    assert.ok(text.includes("This link expires."), "Text should contain footer");
  }
);

test(
  "Given a template row with use_html_override=true, when resolveTemplateText is called, then it strips HTML tags from the override",
  () => {
    const row = {
      use_html_override: true,
      html_override: "<p>Custom <b>HTML</b></p>",
      greeting: "Ignored",
      body: "Ignored",
      button_text: "Ignored",
      footer: "Ignored",
    };
    const result = resolveTemplateText(row, { buttonUrl: "https://example.com" });
    assert.ok(!result.includes("<p>"), "Should strip HTML tags");
    assert.ok(result.includes("Custom"), "Should preserve text content");
    assert.ok(result.includes("HTML"), "Should preserve text content");
  }
);
