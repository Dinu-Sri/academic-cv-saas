"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FilePlus2, FileText, Loader2, Plus } from "lucide-react";
import { PdfCanvasPreview } from "@/components/pdf-canvas-preview";

type CvTemplate = {
  key: "classic" | "modern" | "detailed";
  name: string;
  description: string;
};

type CvDocumentSummary = {
  id: string;
  title: string;
  templateKey: string;
  visibleSectionKeys: string[];
  pdfReady: boolean;
  pdfError: string;
  updatedAt: string;
};

type SectionOption = {
  key: string;
  title: string;
  entryCount: number;
};

type BuildCvWorkspaceProps = {
  displayName: string;
  completeness: number;
  entryCount: number;
  sectionCount: number;
  documents: CvDocumentSummary[];
  sectionOptions: SectionOption[];
};

const cvTemplates: CvTemplate[] = [
  {
    key: "classic",
    name: "Classic",
    description: "Traditional academic CV."
  },
  {
    key: "modern",
    name: "Modern",
    description: "Cleaner spacing with stronger profile focus."
  },
  {
    key: "detailed",
    name: "Detailed",
    description: "For longer academic histories."
  }
];

export function BuildCvWorkspace({
  displayName,
  completeness,
  entryCount,
  sectionCount,
  documents,
  sectionOptions
}: BuildCvWorkspaceProps) {
  const fallbackDocument = useMemo<CvDocumentSummary>(
    () => ({
      id: "",
      title: displayName ? `${displayName} CV` : "Main Academic CV",
      templateKey: "classic",
      visibleSectionKeys: sectionOptions.filter((section) => section.entryCount > 0).map((section) => section.key),
      pdfReady: false,
      pdfError: "",
      updatedAt: ""
    }),
    [displayName, sectionOptions]
  );
  const [cvDocuments, setCvDocuments] = useState<CvDocumentSummary[]>(documents.length > 0 ? documents : [fallbackDocument]);
  const [activeDocumentId, setActiveDocumentId] = useState(cvDocuments[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">(cvDocuments[0]?.pdfReady ? "ready" : "idle");
  const [renderError, setRenderError] = useState(cvDocuments[0]?.pdfError ?? "");
  const [renderProgress, setRenderProgress] = useState(0);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const pdfPreviewUrlRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);

  const activeDocument = cvDocuments.find((document) => document.id === activeDocumentId) ?? cvDocuments[0] ?? fallbackDocument;
  const activeTemplate = cvTemplates.find((template) => template.key === activeDocument.templateKey) ?? cvTemplates[0];
  const selectedKeys = new Set(activeDocument.visibleSectionKeys);
  const selectedSectionCount = sectionOptions.filter((section) => selectedKeys.has(section.key)).length;
  const statusPercent = status === "generating" ? renderProgress : completeness;
  const isGenerating = status === "generating";

  async function createCv() {
    const response = await fetch("/api/cv/documents", {
      method: "POST"
    });

    if (!response.ok) {
      setRenderError("Could not create a new CV version.");
      return;
    }

    const result = (await response.json()) as { document: CvDocumentSummary };
    setCvDocuments((items) => [result.document, ...items.filter((item) => item.id)]);
    clearPdfPreview();
    setStatus("idle");
    setRenderError("");
    setActiveDocumentId(result.document.id);
  }

  function selectDocument(document: CvDocumentSummary) {
    clearPdfPreview();
    setStatus(document.pdfReady ? "ready" : "idle");
    setRenderError(document.pdfError ?? "");
    setActiveDocumentId(document.id);
  }

  function updateActiveDocument(update: Partial<Pick<CvDocumentSummary, "templateKey" | "visibleSectionKeys" | "title">>) {
    if (!activeDocument.id) return;

    const nextDocument = { ...activeDocument, ...update };
    setCvDocuments((items) => items.map((item) => (item.id === activeDocument.id ? nextDocument : item)));
    setRenderError("");

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void saveDocument(nextDocument);
    }, 350);
  }

  async function saveDocument(document: CvDocumentSummary) {
    const response = await fetch(`/api/cv/documents/${document.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: document.title,
        templateKey: document.templateKey,
        visibleSectionKeys: document.visibleSectionKeys
      })
    });

    if (!response.ok) {
      setRenderError("Could not save this CV version.");
      return;
    }

    const result = (await response.json()) as { document: CvDocumentSummary };
    setCvDocuments((items) => items.map((item) => (item.id === result.document.id ? result.document : item)));
  }

  async function generateCv() {
    let document = activeDocument;
    if (!document.id) {
      const response = await fetch("/api/cv/documents", { method: "POST" });
      if (!response.ok) {
        setRenderError("Could not create a CV version before generating.");
        return;
      }
      const result = (await response.json()) as { document: CvDocumentSummary };
      document = result.document;
      setCvDocuments([document]);
      setActiveDocumentId(document.id);
    }

    setStatus("generating");
    setRenderProgress(0);
    setRenderError("");
    clearPdfPreview();

    const response = await fetch("/api/cv/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: document.id,
        templateKey: document.templateKey,
        visibleSectionKeys: document.visibleSectionKeys
      })
    });

    if (!response.ok) {
      setStatus("error");
      setRenderError("Could not start the PDF renderer.");
      return;
    }

    const result = (await response.json()) as { documentId: string; jobId?: string; pdfReady?: boolean; pdfError?: string };
    setRenderError(result.pdfError ?? "");
    setStatus(result.jobId ? "generating" : result.pdfReady ? "ready" : "error");
    setRenderProgress(result.jobId ? 8 : result.pdfReady ? 100 : 0);

    if (result.jobId) {
      pollRenderJob(result.jobId, result.documentId);
    }
  }

  function pollRenderJob(jobId: string, documentId: string) {
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
        pdfReady?: boolean;
        pdfError?: string;
      };

      if (result.pdfReady) {
        setRenderProgress(100);
        setStatus("ready");
        setRenderError("");
        setCvDocuments((items) => items.map((item) => (item.id === documentId ? { ...item, pdfReady: true, pdfError: "" } : item)));
        void loadPdfPreview(documentId);
        return;
      }

      if (result.status === "failed") {
        setRenderProgress(0);
        setStatus("error");
        setRenderError(result.pdfError || result.message || "PDF rendering failed.");
        setCvDocuments((items) => items.map((item) => (item.id === documentId ? { ...item, pdfReady: false, pdfError: result.pdfError || result.message || "" } : item)));
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

  async function loadPdfPreview(documentId: string) {
    const response = await fetch(`/api/cv/download?documentId=${encodeURIComponent(documentId)}&disposition=inline`, {
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

  useEffect(() => {
    if (!activeDocument.id || !activeDocument.pdfReady) return;

    let cancelled = false;
    async function loadSelectedPreview() {
      const response = await fetch(`/api/cv/download?documentId=${encodeURIComponent(activeDocument.id)}&disposition=inline`, {
        credentials: "include"
      });

      if (cancelled) return;

      if (!response.ok) {
        setRenderError(response.status === 401 ? "Please login again before viewing or downloading the PDF." : "Could not load the generated PDF preview.");
        return;
      }

      const blob = await response.blob();
      if (cancelled) return;

      const nextUrl = URL.createObjectURL(blob);
      if (pdfPreviewUrlRef.current) {
        URL.revokeObjectURL(pdfPreviewUrlRef.current);
      }
      pdfPreviewUrlRef.current = nextUrl;
      setPdfPreviewUrl(nextUrl);
    }

    void loadSelectedPreview();

    return () => {
      cancelled = true;
      if (pdfPreviewUrlRef.current) {
        URL.revokeObjectURL(pdfPreviewUrlRef.current);
        pdfPreviewUrlRef.current = "";
      }
    };
  }, [activeDocument.id, activeDocument.pdfReady]);

  async function downloadPdf() {
    if (!activeDocument.id) return;

    const response = await fetch(`/api/cv/download?documentId=${encodeURIComponent(activeDocument.id)}`, {
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

  function toggleSection(sectionKey: string) {
    const nextKeys = selectedKeys.has(sectionKey)
      ? activeDocument.visibleSectionKeys.filter((key) => key !== sectionKey)
      : [...activeDocument.visibleSectionKeys, sectionKey];
    updateActiveDocument({ visibleSectionKeys: nextKeys });
  }

  return (
    <section className="workspace-screen cv-workspace">
      <div className="managed-cv-shell">
        <main className="managed-cv-main">
          <section className="managed-cv-panel">
            <div className="managed-cv-header">
              <div>
                <span className="section-label">Managed CVs</span>
                <h1>{activeDocument.title || "Academic CV"}</h1>
              </div>
              <div className="editor-toolbar-actions">
                {activeDocument.pdfReady ? (
                  <button className="secondary-action compact-action" type="button" onClick={() => void downloadPdf()}>
                    <Download size={16} />
                    Download PDF
                  </button>
                ) : null}
                <button className="primary-action generate-action" type="button" onClick={() => void generateCv()} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="spin-icon" size={16} /> : <FileText size={16} />}
                  {isGenerating ? "Generating" : "Generate My CV"}
                </button>
              </div>
            </div>

            <label className="cv-title-field">
              CV name
              <input value={activeDocument.title} onChange={(event) => updateActiveDocument({ title: event.target.value })} />
            </label>

            <section className="cv-builder-section compact-builder-section">
              <h2>Choose Template</h2>
              <div className="template-choice-grid">
                {cvTemplates.map((template) => (
                  <button
                    className={`template-choice ${activeTemplate.key === template.key ? "is-selected" : ""}`}
                    key={template.key}
                    type="button"
                    onClick={() => updateActiveDocument({ templateKey: template.key })}
                  >
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="cv-builder-section compact-builder-section">
              <h2>Turn On/Off CV Fields</h2>
              <div className="cv-field-switches">
                {sectionOptions.map((section) => (
                  <button
                    className={`cv-field-switch ${selectedKeys.has(section.key) ? "is-on" : ""}`}
                    key={section.key}
                    type="button"
                    onClick={() => toggleSection(section.key)}
                  >
                    <span>{section.title}</span>
                    <small>{section.entryCount} item{section.entryCount === 1 ? "" : "s"}</small>
                  </button>
                ))}
              </div>
            </section>
          </section>

          <aside className={`cv-build-preview managed-preview ${isGenerating ? "is-generating" : ""}`}>
            <div className="editor-status-header">
              <span className="section-label">{isGenerating ? "Making your LaTeX CV" : "CV Preview"}</span>
              <strong>{statusPercent}%</strong>
            </div>
            <div className="status-meter"><span style={{ width: `${statusPercent}%` }} /></div>
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
                  <span>Add entries, then click Generate My CV to see your CV.</span>
                </div>
              )}
            </div>
          </aside>
        </main>

        <aside className="cv-version-panel">
          <div className="cv-version-header">
            <span className="section-label">Available CVs</span>
            <button className="icon-button" type="button" onClick={() => void createCv()} aria-label="Create CV">
              <Plus size={18} />
            </button>
          </div>
          <div className="cv-version-list">
            {cvDocuments.filter((item) => item.id).map((document) => (
              <button
                className={`cv-version-item ${document.id === activeDocument.id ? "is-active" : ""}`}
                key={document.id}
                type="button"
                onClick={() => selectDocument(document)}
              >
                <FilePlus2 size={18} />
                <span>
                  <strong>{document.title}</strong>
                  <small>{templateName(document.templateKey)} template</small>
                </span>
              </button>
            ))}
          </div>
          <div className="cv-version-summary">
            <strong>{selectedSectionCount}</strong>
            <span>fields on</span>
            <strong>{entryCount}</strong>
            <span>entries saved</span>
            <strong>{sectionCount}</strong>
            <span>sections with content</span>
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

function templateName(templateKey: string) {
  return cvTemplates.find((template) => template.key === templateKey)?.name ?? "Classic";
}
