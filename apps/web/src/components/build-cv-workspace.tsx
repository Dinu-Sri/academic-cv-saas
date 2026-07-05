"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";

type CvTemplate = {
  key: string;
  name: string;
  description: string;
};

type BuildCvWorkspaceProps = {
  displayName: string;
  completeness: number;
  entryCount: number;
  sectionCount: number;
  previewHtml: string;
  currentTemplate: string;
};

const cvTemplates: CvTemplate[] = [
  {
    key: "classic",
    name: "Classic",
    description: "Clean academic CV with traditional section hierarchy."
  },
  {
    key: "modern",
    name: "Modern",
    description: "Compact layout with stronger profile and research emphasis."
  },
  {
    key: "detailed",
    name: "Detailed",
    description: "Best for senior academics with many sections and outputs."
  }
];

export function BuildCvWorkspace({
  displayName,
  completeness,
  entryCount,
  sectionCount,
  previewHtml,
  currentTemplate
}: BuildCvWorkspaceProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(currentTemplate || "classic");
  const [preview, setPreview] = useState(previewHtml);
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">(previewHtml ? "ready" : "idle");
  const ready = completeness >= 20 && entryCount > 0;
  const readiness = useMemo(
    () => [
      { label: "Profile details", done: completeness >= 20 },
      { label: "Academic entries", done: entryCount > 0 },
      { label: "CV preview", done: Boolean(preview) }
    ],
    [completeness, entryCount, preview]
  );

  async function generateCv() {
    setStatus("generating");

    const response = await fetch("/api/cv/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateKey: selectedTemplate })
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    const result = (await response.json()) as { previewHtml: string };
    setPreview(result.previewHtml);
    setStatus("ready");
  }

  return (
    <section className="workspace-screen cv-workspace">
      <div className="cv-build-shell">
        <main className="cv-build-main">
          <div className="cv-build-toolbar">
            <div>
              <span className="section-label">Build CV</span>
              <h1>{displayName || "Academic CV"}</h1>
            </div>
            <button className="primary-action generate-action" type="button" onClick={generateCv} disabled={status === "generating"}>
              {status === "generating" ? <Loader2 size={16} /> : <FileText size={16} />}
              {status === "generating" ? "Generating" : "Generate My CV"}
            </button>
          </div>

          <section className="cv-builder-section">
            <h2>Choose Template</h2>
            <div className="template-choice-grid">
              {cvTemplates.map((template) => (
                <button
                  className={`template-choice ${selectedTemplate === template.key ? "is-selected" : ""}`}
                  key={template.key}
                  type="button"
                  onClick={() => setSelectedTemplate(template.key)}
                >
                  <strong>{template.name}</strong>
                  <span>{template.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="cv-builder-section">
            <h2>Ready Check</h2>
            <div className="cv-ready-grid">
              {readiness.map((item) => (
                <div className={`cv-ready-item ${item.done ? "is-done" : ""}`} key={item.label}>
                  <CheckCircle2 size={17} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="cv-build-preview">
          <div className="editor-status-header">
            <span className="section-label">CV Preview</span>
            <strong>{completeness}%</strong>
          </div>
          <dl className="status-facts">
            <div><dt>Sections</dt><dd>{sectionCount}</dd></div>
            <div><dt>Entries</dt><dd>{entryCount}</dd></div>
            <div><dt>Status</dt><dd>{status === "ready" ? "Ready" : ready ? "Draft" : "Needs info"}</dd></div>
          </dl>
          <div className="cv-preview-frame large-preview">
            {preview ? (
              <div dangerouslySetInnerHTML={{ __html: preview }} />
            ) : (
              <div className="preview-empty">
                <FileText size={34} />
                <span>Generate My CV</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
