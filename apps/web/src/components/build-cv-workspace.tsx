"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileText, Loader2 } from "lucide-react";
import { PdfCanvasPreview } from "@/components/pdf-canvas-preview";

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
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">(previewHtml ? "ready" : "idle");
  const [downloadReady, setDownloadReady] = useState(pdfReady);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [renderError, setRenderError] = useState(pdfError);
  const [renderProgress, setRenderProgress] = useState(0);
  const pdfPreviewUrlRef = useRef("");
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
    setRenderProgress(0);
    setDownloadReady(false);
    setRenderError("");
    clearPdfPreview();

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
    setDownloadReady(Boolean(result.pdfReady));
    setRenderError(result.pdfError ?? "");
    setStatus(result.jobId ? "generating" : result.pdfReady ? "ready" : "error");
    setRenderProgress(result.jobId ? 8 : result.pdfReady ? 100 : 0);

    if (result.jobId) {
      pollRenderJob(result.jobId);
    }
  }

  function pollRenderJob(jobId: string) {
    let attempts = 0;

    const check = async () => {
      attempts += 1;
      setRenderProgress((current) => Math.min(96, Math.max(current + 4, attempts * 4)));
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

      if (result.pdfReady) {
        setRenderProgress(100);
        setDownloadReady(true);
        setRenderError("");
        setStatus("ready");
        void loadPdfPreview();
        return;
      }

      if (result.status === "failed") {
        setRenderProgress(0);
        setDownloadReady(false);
        setRenderError(result.pdfError || result.message || "PDF rendering failed.");
        setStatus("error");
        return;
      }

      if (attempts < 90) {
        window.setTimeout(check, 1000);
        return;
      }

      setStatus("error");
      setRenderError("PDF rendering is taking longer than expected. Please check again shortly.");
    };

    window.setTimeout(check, 700);
  }

  async function loadPdfPreview() {
    const response = await fetch(`/api/cv/download?disposition=inline&ts=${Date.now()}`, {
      credentials: "include"
    });

    if (!response.ok) {
      setRenderError(response.status === 401 ? "Please login again before viewing or downloading the PDF." : "Could not load the generated PDF preview.");
      return;
    }

    const blob = await response.blob();
    const nextUrl = URL.createObjectURL(blob);
    if (pdfPreviewUrlRef.current) {
      URL.revokeObjectURL(pdfPreviewUrlRef.current);
    }
    pdfPreviewUrlRef.current = nextUrl;
    setPdfPreviewUrl(nextUrl);
  }

  function clearPdfPreview() {
    if (pdfPreviewUrlRef.current) {
      URL.revokeObjectURL(pdfPreviewUrlRef.current);
      pdfPreviewUrlRef.current = "";
    }
    setPdfPreviewUrl("");
  }

  async function downloadPdf() {
    const response = await fetch(`/api/cv/download?ts=${Date.now()}`, {
      credentials: "include"
    });

    if (!response.ok) {
      setRenderError(response.status === 401 ? "Please login again before downloading the PDF." : "Could not download the generated PDF.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filenameFromDisposition(response.headers.get("Content-Disposition")) || "academic-cv.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  useEffect(() => {
    if (downloadReady) {
      void loadPdfPreview();
    }

    return () => {
      if (pdfPreviewUrlRef.current) {
        URL.revokeObjectURL(pdfPreviewUrlRef.current);
        pdfPreviewUrlRef.current = "";
      }
    };
  }, [downloadReady]);

  const isGenerating = status === "generating";
  const statusPercent = isGenerating ? renderProgress : completeness;

  return (
    <section className="workspace-screen cv-workspace">
      <div className="cv-build-shell">
        <main className="cv-build-main">
          <div className="cv-build-toolbar">
            <div>
              <span className="section-label">Build CV</span>
              <h1>{displayName || "Academic CV"}</h1>
            </div>
            <div className="editor-toolbar-actions">
              {downloadReady ? (
                <button className="secondary-action compact-action" type="button" onClick={() => void downloadPdf()}>
                  <Download size={16} />
                  Download PDF
                </button>
              ) : null}
              <button className="primary-action generate-action" type="button" onClick={generateCv} disabled={status === "generating"}>
                {status === "generating" ? <Loader2 className="spin-icon" size={16} /> : <FileText size={16} />}
                {status === "generating" ? "Generating" : "Generate My CV"}
              </button>
            </div>
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

        <aside className={`cv-build-preview ${isGenerating ? "is-generating" : ""}`}>
          <div className="editor-status-header">
            <span className="section-label">{isGenerating ? "Making your LaTeX CV" : "CV Preview"}</span>
            <strong>{statusPercent}%</strong>
          </div>
          <div className="status-meter"><span style={{ width: `${statusPercent}%` }} /></div>
          <dl className="status-facts">
            <div><dt>Sections</dt><dd>{sectionCount}</dd></div>
            <div><dt>Entries</dt><dd>{entryCount}</dd></div>
            <div><dt>PDF</dt><dd>{isGenerating ? "Generating" : downloadReady ? "Ready" : "Draft"}</dd></div>
          </dl>
          {renderError ? <p className="render-error">{renderError}</p> : null}
          <div className="cv-preview-frame large-preview">
            {pdfPreviewUrl ? (
              <PdfCanvasPreview sourceUrl={pdfPreviewUrl} />
            ) : isGenerating ? (
              <div className="preview-empty preview-progress">
                <Loader2 className="spin-icon" size={34} />
                <span>We are making your LaTeX CV.</span>
                <small>The PDF will appear here automatically.</small>
              </div>
            ) : (
              <div className="preview-empty">
                <FileText size={34} />
                <span>Add your entries and click Generate My CV to see your CV.</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? "";
}
