"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileText, Loader2 } from "lucide-react";

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
  pdfReady: boolean;
  pdfError: string;
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
  currentTemplate,
  pdfReady,
  pdfError
}: BuildCvWorkspaceProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(currentTemplate || "classic");
  const [preview, setPreview] = useState(previewHtml);
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">(previewHtml ? "ready" : "idle");
  const [downloadReady, setDownloadReady] = useState(pdfReady);
  const [renderError, setRenderError] = useState(pdfError);
  const readiness = useMemo(
    () => [
      { label: "Profile details", done: completeness >= 20 },
      { label: "Academic entries", done: entryCount > 0 },
      { label: "PDF file", done: downloadReady }
    ],
    [completeness, downloadReady, entryCount]
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
      setRenderError("Could not start the PDF renderer.");
      return;
    }

    const result = (await response.json()) as { previewHtml: string; jobId?: string; pdfReady?: boolean; pdfError?: string };
    setPreview(result.previewHtml);
    setDownloadReady(Boolean(result.pdfReady));
    setRenderError(result.pdfError ?? "");
    setStatus(result.jobId ? "generating" : result.pdfReady ? "ready" : "error");

    if (result.jobId) {
      pollRenderJob(result.jobId);
    }
  }

  function pollRenderJob(jobId: string) {
    let attempts = 0;

    const check = async () => {
      attempts += 1;
      const response = await fetch(`/api/cv/jobs/${jobId}`);
      if (!response.ok) {
        setStatus("error");
        setRenderError("Could not check PDF render status.");
        return;
      }

      const result = (await response.json()) as {
        status: string;
        message?: string;
        previewHtml?: string;
        pdfReady?: boolean;
        pdfError?: string;
      };

      if (result.previewHtml) {
        setPreview(result.previewHtml);
      }

      if (result.pdfReady) {
        setDownloadReady(true);
        setRenderError("");
        setStatus("ready");
        return;
      }

      if (result.status === "failed") {
        setDownloadReady(false);
        setRenderError(result.pdfError || result.message || "PDF rendering failed.");
        setStatus("error");
        return;
      }

      if (attempts < 60) {
        window.setTimeout(check, 2000);
        return;
      }

      setStatus("error");
      setRenderError("PDF rendering is taking longer than expected. Please check again shortly.");
    };

    window.setTimeout(check, 1200);
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
            {downloadReady ? (
              <a className="secondary-action compact-action" href="/api/cv/download">
                <Download size={16} />
                Download PDF
              </a>
            ) : null}
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
            <div><dt>PDF</dt><dd>{downloadReady ? "Ready" : status === "generating" ? "Generating" : "Draft"}</dd></div>
          </dl>
          {renderError ? <p className="render-error">{renderError}</p> : null}
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
