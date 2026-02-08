import { useEffect, useMemo, useState } from "react";
import RootLayout from "../../../components/layout/layout";
import PortalShell from "../../../components/Portal/PortalShell/PortalShell";
import AdminMenu from "../../../components/Portal/AdminMenu/AdminMenu";
import { requireSuperAdminSSR } from "../../../utils/portal/ssr-helpers.js";
import { portalFetch } from "../../../utils/portal/portal-fetch.js";
import { renderTemplate } from "../../../utils/portal/template-renderer.js";
import { assembleHtml } from "../../../utils/portal/email-html-builder.js";

const SAMPLE_VARIABLES = {
  "participant-login": {
    loginUrl: "https://example.com/api/portal/participant/verify?token=abc123",
    firstName: "Jane",
    email: "jane@example.com",
  },
  "admin-welcome": {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    password: "TempPass123",
    loginUrl: "https://example.com/portal/admin",
  },
};

const TABS = ["fields", "html-override", "preview"];
const TAB_LABELS = { fields: "Template Fields", "html-override": "HTML Override", preview: "Preview" };

const EmailConfigPage = ({ adminRole }) => {
  const [templates, setTemplates] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [form, setForm] = useState({
    subject: "",
    greeting: "",
    body: "",
    button_text: "",
    footer: "",
    html_override: "",
    use_html_override: false,
    available_variables: "[]",
  });
  const [activeTab, setActiveTab] = useState("fields");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTemplates = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await portalFetch("/api/portal/email-templates");
      const data = await response.json();
      if (Array.isArray(data)) {
        setTemplates(data);
        if (data.length > 0 && !selectedSlug) {
          setSelectedSlug(data[0].slug);
          populateForm(data[0]);
        }
      }
    } catch (err) {
      setError("Unable to load email templates.");
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (template) => {
    setForm({
      subject: template.subject || "",
      greeting: template.greeting || "",
      body: template.body || "",
      button_text: template.button_text || "",
      footer: template.footer || "",
      html_override: template.html_override || "",
      use_html_override: Boolean(template.use_html_override),
      available_variables: template.available_variables || "[]",
    });
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSlugChange = (event) => {
    const slug = event.target.value;
    setSelectedSlug(slug);
    setSuccess("");
    setError("");
    const template = templates.find((t) => t.slug === slug);
    if (template) populateForm(template);
  };

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await portalFetch(`/api/portal/email-templates/${selectedSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templates.find((t) => t.slug === selectedSlug)?.name || selectedSlug,
          subject: form.subject,
          greeting: form.greeting,
          body: form.body,
          button_text: form.button_text,
          footer: form.footer,
          html_override: form.html_override,
          use_html_override: form.use_html_override,
          available_variables: form.available_variables,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data?.error || "Unable to save template.");
        return;
      }
      setSuccess("Template saved.");
      await loadTemplates();
    } catch (err) {
      setError("Unable to save template.");
    } finally {
      setSaving(false);
    }
  };

  const parsedVariables = useMemo(() => {
    try {
      return JSON.parse(form.available_variables);
    } catch {
      return [];
    }
  }, [form.available_variables]);

  const renderWithSampleVars = (text) => {
    const vars = SAMPLE_VARIABLES[selectedSlug] || {};
    return renderTemplate(text, vars);
  };

  const previewHtml = useMemo(() => {
    if (form.use_html_override && form.html_override) {
      return renderWithSampleVars(form.html_override);
    }
    const raw = assembleHtml({
      greeting: form.greeting,
      body: form.body,
      buttonText: form.button_text,
      buttonUrl: "#",
      footer: form.footer,
    });
    return renderWithSampleVars(raw);
  }, [form, selectedSlug]);

  return (
    <div>
      <PortalShell title="Email Config" subtitle="Edit email templates sent by the portal.">
        <div className="row g-3 mb-4 align-items-end">
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="template-select">
              Select template
            </label>
            <select
              id="template-select"
              className="form-select"
              value={selectedSlug}
              onChange={handleSlugChange}
            >
              {templates.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-6 text-md-end">
            <AdminMenu adminRole={adminRole} />
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        {loading && <div className="text-muted">Loading templates...</div>}

        {selectedSlug && (
          <>
            <ul className="nav nav-tabs mb-3">
              {TABS.map((tab) => (
                <li className="nav-item" key={tab}>
                  <button
                    className={`nav-link${activeTab === tab ? " active" : ""}`}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                </li>
              ))}
            </ul>

            {activeTab === "fields" && (
              <div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="tpl-subject">Subject</label>
                  <input
                    id="tpl-subject"
                    className="form-control"
                    value={form.subject}
                    onChange={handleFieldChange("subject")}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="tpl-greeting">Greeting</label>
                  <input
                    id="tpl-greeting"
                    className="form-control"
                    value={form.greeting}
                    onChange={handleFieldChange("greeting")}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="tpl-body">Body</label>
                  <textarea
                    id="tpl-body"
                    className="form-control"
                    rows={5}
                    value={form.body}
                    onChange={handleFieldChange("body")}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="tpl-button-text">Button text</label>
                  <input
                    id="tpl-button-text"
                    className="form-control"
                    value={form.button_text}
                    onChange={handleFieldChange("button_text")}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="tpl-footer">Footer</label>
                  <textarea
                    id="tpl-footer"
                    className="form-control"
                    rows={2}
                    value={form.footer}
                    onChange={handleFieldChange("footer")}
                  />
                </div>
                <div className="text-muted small mb-3">
                  Available variables: {parsedVariables.map((v) => `{{${v}}}`).join(", ") || "None"}
                </div>
              </div>
            )}

            {activeTab === "html-override" && (
              <div>
                <div className="form-check mb-3">
                  <input
                    id="tpl-use-override"
                    className="form-check-input"
                    type="checkbox"
                    checked={form.use_html_override}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, use_html_override: e.target.checked }))
                    }
                  />
                  <label className="form-check-label" htmlFor="tpl-use-override">
                    Use custom HTML override
                  </label>
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="tpl-html-override">HTML override</label>
                  <textarea
                    id="tpl-html-override"
                    className="form-control font-monospace"
                    rows={12}
                    value={form.html_override}
                    onChange={handleFieldChange("html_override")}
                    disabled={!form.use_html_override}
                  />
                </div>
                <div className="text-muted small mb-3">
                  Available variables: {parsedVariables.map((v) => `{{${v}}}`).join(", ") || "None"}
                </div>
              </div>
            )}

            {activeTab === "preview" && (
              <div>
                <div className="mb-2">
                  <strong>Subject:</strong> {renderWithSampleVars(form.subject)}
                </div>
                <div
                  className="border rounded p-2"
                  style={{ background: "#f8f9fa", minHeight: 200 }}
                >
                  <iframe
                    srcDoc={previewHtml}
                    title="Email preview"
                    style={{ width: "100%", minHeight: 200, border: "none" }}
                    sandbox=""
                  />
                </div>
              </div>
            )}

            <div className="mt-3">
              <button
                className="btn btn-primary"
                type="button"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? "Saving..." : "Save template"}
              </button>
            </div>
          </>
        )}
      </PortalShell>
    </div>
  );
};

export const getServerSideProps = async ({ req }) => requireSuperAdminSSR(req);

EmailConfigPage.getLayout = function getLayout(page) {
  return <RootLayout>{page}</RootLayout>;
};

export default EmailConfigPage;
